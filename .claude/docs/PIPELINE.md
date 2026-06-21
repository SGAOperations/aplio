# Agent Pipeline

This repo uses a Claude Code agent pipeline to take GitHub Issues from idea to merge-ready PR with minimal human intervention. A single `/pipeline` session is the human's cockpit: it polls GitHub, dispatches background stage subagents, relays their questions, and applies every label. Humans converse; they never run `gh` commands. GitHub labels remain the durable state machine, so progress is always visible on GitHub and manual intervention always works.

## Quick start

```
claude        # open a session (haiku recommended for the cockpit)
/pipeline     # start the cockpit
```

Then talk to it: `work on #142` · `scope out a notifications feature` · `status` · `pause #142` · `retry #142` · `drain` · `resume` · `stop #142`.

## The two flows

### Major feature

| Step            | You (in the cockpit)                                                     | Behind the scenes                                                                                                               |
| --------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| 1. Describe     | "scope out X" — short conversation                                       | `/scope` creates the epic + sub-tickets, linked and dependency-ordered                                                          |
| 2. Start        | "work on #N" + choose: review the plan, or auto-approve                  | `plan-agent` researches the codebase and writes a plan into the issue; its questions pop up in your terminal                    |
| 3. Approve plan | Read the summary, approve — or give feedback (it revises and comes back) | `impl-agent` builds in an isolated worktree, runs CI, opens a PR; `review-agent`/`revise-agent` loop until clean (max 3 rounds) |
| 4. Merge        | Click merge on GitHub                                                    | Issue closes automatically                                                                                                      |

### Bug fix

File the issue → in the cockpit: "work on #N, auto-approve the plan" → wait → merge on GitHub. The plan gate is skipped (`auto plan`); the merge gate never is.

## Architecture

- **Cockpit** (`/pipeline`, a skill) runs in the human's interactive session. It owns the conversation, the human gates (`AskUserQuestion`), and the wakeup schedule (`ScheduleWakeup`) — tools that only exist in a main session, not a subagent.
- **Stage workers** are **subagents** in `.claude/agents/` (`plan-agent`, `impl-agent`, `review-agent`, `revise-agent`). Each carries its own `model`, tool scope, `permissionMode`, and (for the two that write code) `isolation: worktree` in its frontmatter. The cockpit dispatches by `subagent_type`; it sets nothing else at the call site.
- **`impl-agent` and `revise-agent` get their own isolated git worktree** off `main` — a fresh checkout where they `npm ci` + `npx prisma generate`, do the work, and push a feature branch. No manual `git worktree`, symlinks, or `.env` are involved (the CI checks and Prisma generate need none).
- **`plan-agent` and `review-agent` are read-only on source** (`disallowedTools: Edit`); they only read code and write to GitHub via `gh`.

### Why background dispatch needs care

Background subagents **auto-deny any tool call that would otherwise prompt** (they cannot show a permission dialog), so a too-tight allowlist makes them stall silently — and, worse, improvise harmful workarounds (hand-edited lockfiles, abandoned libraries). We therefore **allow broad dev-command categories** (`gh`/`git`/`npm`/`npx`) in `.claude/settings.json` and rely on the **`deny`** list for the few genuinely dangerous operations (deny beats allow at every scope). File edits are covered by each worker's `permissionMode: acceptEdits`. The worktree is a checkout of `main`, so it carries the committed `settings.json` — **permission changes take effect for dispatched agents only after they land on `main`.** Agents also run with **`disallowedTools: Agent`** (no nested subagents), a **`maxTurns`** backstop, and an explicit rule to **stop and emit `BLOCKED:` rather than improvise** when a command is denied.

### File-based GitHub I/O

Agents never pass large markdown (plans, reviews, comments) as an inline `--body "..."` argument — shell quoting of backticks/code-fences fails cross-platform. They write the payload to `.temp/` (gitignored) and use `gh ... --body-file`. The same applies to the cockpit's escalation comments.

## Label lifecycle

Rule: **every stage agent's first action is swapping its trigger label for its in-flight label.** Absence of a trigger label means the cockpit skips the item — a tick can never double-dispatch. A crashed agent leaves the item parked in an in-flight label; recovery = re-apply the trigger label (`retry #N`).

### Issue labels

| Label                    | Set by                                   | Type      | Meaning                                           |
| ------------------------ | ---------------------------------------- | --------- | ------------------------------------------------- |
| `claude`                 | Cockpit (at opt-in)                      | marker    | Claude is handling this ticket                    |
| `ready`                  | Cockpit (at opt-in)                      | trigger   | Dispatch `plan-agent`                             |
| `planning`               | `plan-agent`                             | in-flight | Plan being researched/written                     |
| `plan review`            | `plan-agent`                             | gate      | Plan written — awaiting human approval in cockpit |
| `plan changes requested` | Cockpit (human feedback)                 | trigger   | Dispatch `plan-agent` in revision mode            |
| `plan approved`          | Cockpit (human approval, or `auto plan`) | trigger   | Dispatch `impl-agent`                             |
| `auto plan`              | Cockpit (at opt-in)                      | marker    | Plan gate skipped: `plan review` auto-approved    |
| `in progress`            | `impl-agent`                             | in-flight | Implementation underway                           |
| `pr opened`              | `impl-agent`                             | terminal  | PR open; remaining state tracked on the PR        |
| `blocked`                | `impl-agent`                             | gate      | Needs human decision; details in issue comment    |

### PR labels

| Label              | Set by                        | Type      | Meaning                                                         |
| ------------------ | ----------------------------- | --------- | --------------------------------------------------------------- |
| `ready for review` | `impl-agent` / `revise-agent` | trigger   | Dispatch `review-agent`                                         |
| `reviewing`        | `review-agent`                | in-flight | Review underway                                                 |
| `needs revision`   | `review-agent`                | trigger   | Dispatch `revise-agent` (subject to cycle cap)                  |
| `revising`         | `revise-agent`                | in-flight | Fixes underway                                                  |
| `approved`         | `review-agent`                | terminal  | Only Low/Nit findings; human merges on GitHub                   |
| `needs human`      | Cockpit / `revise-agent`      | gate      | 3 cycles without convergence or rebase conflict; pipeline stops |

## Stages and models

| Stage        | Definition                       | Model                                     | Why                                                     |
| ------------ | -------------------------------- | ----------------------------------------- | ------------------------------------------------------- |
| Cockpit      | `.claude/skills/pipeline/`       | haiku (session)                           | Mechanical: queries, label swaps, dispatch, relaying    |
| 0. Scope     | `.claude/skills/scope/`          | inherits session (opus/fable recommended) | Highest-leverage thinking; human is in the conversation |
| 1. Plan      | `.claude/agents/plan-agent.md`   | sonnet                                    | Research + writing; plan quality amplifies downstream   |
| 2. Implement | `.claude/agents/impl-agent.md`   | sonnet                                    | Bulk of code volume; cost/quality sweet spot            |
| 3. Review    | `.claude/agents/review-agent.md` | sonnet                                    | Must catch real issues reliably                         |
| 4. Revise    | `.claude/agents/revise-agent.md` | sonnet                                    | Targeted fixes from a structured list                   |

All four workers read `.claude/docs/ENGINEERING.md` before working; the review agent treats it as a review dimension.

## Permission rationale

The model is **broad allow + authoritative deny**: stage agents do real dev work (install packages, read CI logs, manage git in their worktree), so the allowlist grants broad categories and the `deny` list draws the safety line. **Any permission change must update this section.**

| Allowed (`permissions.allow`)                                     | Used by             | Why                                                                                                                            |
| ----------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `Bash(gh *)`                                                      | all stages, cockpit | Issues/PRs/labels, the diff under review, CI status **and run logs** (`gh run view --log-failed`), `gh api` for version checks |
| `Bash(git *)`                                                     | impl, revise        | All git **inside the agent's own worktree** (fetch/checkout/rebase/commit/push/worktree) — no `git -C` on main                 |
| `Bash(npm *)`                                                     | impl, revise        | `npm ci`, plus `npm install`/`uninstall`/`view` for dependency tickets                                                         |
| `Bash(npx *)`                                                     | impl, revise        | `npx prisma generate`, `npx prettier`, etc.                                                                                    |
| `WebFetch(domain:nextjs.org \| ui.shadcn.com \| code.claude.com)` | all stages          | Fetch current framework / Claude docs instead of stale recall                                                                  |

File writes (source edits, `.temp/` payloads) are authorized by each worker's `permissionMode: acceptEdits`, not by `settings.json`.

**Deny rules (`permissions.deny`) — the safety line:** `gh pr merge` (the human merge gate is absolute), `gh issue delete`, `gh repo delete`, pushes to `main` (`git push * main` / `git push origin main`), and `npm publish`. Deny beats allow at every scope, so these hold even with broad allows. _(Minor known gap: a `git push origin HEAD:main` refspec isn't caught by the `_ main`pattern — rely on the agent instruction + GitHub branch protection.)* Agents **may** edit CI workflow files and lockfiles (some tickets require it) but are instructed to use`npm`for dependencies and **not hand-edit`package.json`/`package-lock.json` as a workaround\*\*.

## Escalation

- **Review ↔ revise non-convergence** — before each revise dispatch the cockpit counts `## Code Review` comments; at 3 with Critical/Medium still found it labels `needs human`, comments, and stops dispatching for it.
- **Impl blocker** — `impl-agent` comments `## Blocker`, labels `blocked`, and reports `BLOCKED:`; the cockpit relays and resumes the same agent with the human's decision.
- **Rebase conflict during revision** — `revise-agent` aborts the rebase, comments, labels `needs human`.
- **Plan questions** — `plan-agent` never guesses: it returns `QUESTIONS FOR HUMAN:` and the cockpit relays, then resumes it with answers.

## Stopping & draining

The pipeline runs autonomously once started; these cockpit commands are the clean off-switch:

- **`drain` / `pause`** — finish in-flight work, start nothing new (stops dispatch **and** wakeups). **`resume`** restarts ticking.
- **`stop #N`** — halt one item: drop its trigger label and `TaskStop` its in-flight agent, resetting the label so it can be retried.
- **`stop` / `halt`** — drain + `TaskStop` all running agents + reset their labels.

Closing the cockpit session also halts dispatch (it is the only dispatcher) but cuts off in-flight agents mid-run — prefer `drain` for a graceful stop.

## Recovery runbook

| Symptom                                                                                           | Cause                                                 | Fix                                                                                                                        |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Issue stuck in `planning` / `in progress`, PR stuck in `reviewing` / `revising`, no agent running | Agent crashed or session closed mid-flight            | `retry #N` in the cockpit — or re-apply the trigger label (`ready`, `plan approved`, `ready for review`, `needs revision`) |
| Nothing dispatches for an item                                                                    | It has no trigger label (paused, in-flight, or gated) | `status` shows where it is; `resume #N` re-applies the right trigger                                                       |
| A stage misbehaved and you want to run it by hand                                                 | —                                                     | @-mention the subagent (`@agent-impl-agent implement #N`) or run `claude --agent impl-agent`                               |
| Cockpit session closed                                                                            | All state is in labels                                | Start `/pipeline` again; it resumes from the labels. `retry #N` anything parked in an in-flight label                      |
| Labels manually changed on GitHub                                                                 | Fine — labels are the source of truth                 | The next tick acts on whatever the labels say                                                                              |
| Stale/locked worktrees under `.claude/worktrees/`                                                 | Agents cut off mid-run leave locked worktrees         | From the main checkout: `git worktree list`, then `git worktree remove --force <path>` and `git worktree prune`            |
| An agent stopped with `BLOCKED:` or hit `maxTurns`                                                | Clean stop by design (not a crash)                    | Resolve the blocker (or widen scope/permissions), then `retry #N`                                                          |

## Reading current state without the cockpit

```bash
gh issue list --repo SGAOperations/aplio --label "plan review"
gh issue list --repo SGAOperations/aplio --label "blocked"
gh pr list --repo SGAOperations/aplio --label "approved"
gh pr list --repo SGAOperations/aplio --label "needs human"
```
