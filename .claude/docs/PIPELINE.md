# Agent Pipeline

This repo uses a Claude Code agent pipeline to take GitHub Issues from idea to merge-ready PR with minimal human intervention. A single `/pipeline` session is the human's cockpit: it polls GitHub, dispatches background stage subagents, relays their questions, and applies every label. Humans converse; they never run `gh` commands. GitHub labels remain the durable state machine, so progress is always visible on GitHub and manual intervention always works.

## Quick start

```
claude        # open a session (haiku recommended for the cockpit)
/pipeline     # start the cockpit
```

Then talk to it: `work on #142` · `scope out a notifications feature` · `status` · `pause #142` · `retry #142`.

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

Background subagents **auto-deny any tool call that would otherwise prompt** (they cannot show a permission dialog). So everything a worker needs must be pre-authorized: file edits via `permissionMode: acceptEdits` in the agent frontmatter, and every `gh`/`git`/`npm` command via `permissions.allow` in `.claude/settings.json`. The worktree is a checkout of `main`, so it carries the committed `settings.json` — **permission changes take effect for dispatched agents only after they land on `main`.**

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

Every entry in `.claude/settings.json`, what uses it, and why. **Any permission change must update this table.**

| Permission                                                                                               | Used by                       | Why                                                                  |
| -------------------------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------- |
| `Bash(gh issue view *)`                                                                                  | all stages                    | Read issue bodies (plans live there), labels, comments               |
| `Bash(gh issue edit *)`                                                                                  | cockpit, plan, impl           | Label transitions; plan written into the issue body                  |
| `Bash(gh issue comment *)`                                                                               | cockpit, plan, impl           | Blocker comments, plan feedback threads                              |
| `Bash(gh issue create *)`                                                                                | scope                         | Create epics and sub-issues                                          |
| `Bash(gh issue list *)`                                                                                  | cockpit                       | Tick queries over trigger/gate labels                                |
| `Bash(gh pr list/view/diff/comment/edit/create/checks *)`                                                | cockpit, impl, review, revise | PR metadata, the diff under review, CI status, comments, labels      |
| `Bash(gh label create *)`                                                                                | setup                         | Create/repair pipeline labels                                        |
| `Bash(gh api repos/SGAOperations/aplio/*)`                                                               | scope                         | Sub-issue linking (REST, database ids) — scoped to this repo         |
| `Bash(gh api graphql *)`                                                                                 | scope, cockpit                | Blocker relationships; blocked-by checks at opt-in                   |
| `Bash(git fetch/checkout/add/commit/push/rebase/reset/branch *)`                                         | impl, revise                  | Work inside the agent's own isolated worktree (cwd — no `-C`)        |
| `Bash(npm ci)`, `Bash(npx prisma generate)`                                                              | impl, revise                  | Fresh worktrees lack `node_modules` and the gitignored Prisma client |
| `Bash(npm run prettier:check / prettier:fix / eslint:check / tsc:check)`, `Bash(npx prettier --write *)` | impl, revise                  | The pre-push CI checks                                               |

File writes (source edits, `.temp/` payloads) are authorized by each worker's `permissionMode: acceptEdits`, not by `settings.json`.

**Deny rules (`permissions.deny`):** `gh pr merge` (the human merge gate is absolute), `gh issue delete`, `gh repo delete`, and pushes to `main`. Deny beats allow at every scope, so these hold even if an agent misbehaves. Feature-branch force pushes use `--force-with-lease` only (revise agent, after a rebase) and are covered by the `git push *` allow minus the `main` deny.

## Escalation

- **Review ↔ revise non-convergence** — before each revise dispatch the cockpit counts `## Code Review` comments; at 3 with Critical/Medium still found it labels `needs human`, comments, and stops dispatching for it.
- **Impl blocker** — `impl-agent` comments `## Blocker`, labels `blocked`, and reports `BLOCKED:`; the cockpit relays and resumes the same agent with the human's decision.
- **Rebase conflict during revision** — `revise-agent` aborts the rebase, comments, labels `needs human`.
- **Plan questions** — `plan-agent` never guesses: it returns `QUESTIONS FOR HUMAN:` and the cockpit relays, then resumes it with answers.

## Recovery runbook

| Symptom                                                                                           | Cause                                                 | Fix                                                                                                                        |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Issue stuck in `planning` / `in progress`, PR stuck in `reviewing` / `revising`, no agent running | Agent crashed or session closed mid-flight            | `retry #N` in the cockpit — or re-apply the trigger label (`ready`, `plan approved`, `ready for review`, `needs revision`) |
| Nothing dispatches for an item                                                                    | It has no trigger label (paused, in-flight, or gated) | `status` shows where it is; `resume #N` re-applies the right trigger                                                       |
| A stage misbehaved and you want to run it by hand                                                 | —                                                     | @-mention the subagent (`@agent-impl-agent implement #N`) or run `claude --agent impl-agent`                               |
| Cockpit session closed                                                                            | All state is in labels                                | Start `/pipeline` again; it resumes from the labels. `retry #N` anything parked in an in-flight label                      |
| Labels manually changed on GitHub                                                                 | Fine — labels are the source of truth                 | The next tick acts on whatever the labels say                                                                              |

## Reading current state without the cockpit

```bash
gh issue list --repo SGAOperations/aplio --label "plan review"
gh issue list --repo SGAOperations/aplio --label "blocked"
gh pr list --repo SGAOperations/aplio --label "approved"
gh pr list --repo SGAOperations/aplio --label "needs human"
```
