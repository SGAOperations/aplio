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
| 3. Approve plan | Read the summary, approve — or give feedback (it revises and comes back) | `impl-agent` builds in an isolated worktree, runs CI, opens a PR; `review-agent`/`revise-agent` loop until clean (max 5 rounds) |
| 4. Merge        | Click merge on GitHub                                                    | Issue closes automatically                                                                                                      |

### Bug fix

File the issue → in the cockpit: "work on #N, auto-approve the plan" → wait → merge on GitHub. The plan gate is skipped (`auto plan`); the merge gate never is.

## Architecture

- **Cockpit** (`/pipeline`, a skill) runs in the human's interactive session. It owns the conversation, the human gates (`AskUserQuestion`), and the wakeup schedule (`ScheduleWakeup`) — tools that only exist in a main session, not a subagent.
- **Stage workers** are **subagents** in `.claude/agents/` (`plan-agent`, `impl-agent`, `review-agent`, `revise-agent`). Each carries its own `model`, tool scope, `permissionMode`, and (for the two that write code) `isolation: worktree` in its frontmatter. The cockpit dispatches by `subagent_type`; it sets nothing else at the call site.
- **`impl-agent` and `revise-agent` get their own isolated git worktree** — a fresh checkout where they `npm ci` + `npm run prisma:generate`, do the work, and push a feature branch. impl branches from `main`; **revise rebases onto the PR's base branch** (`baseRefName`, not assumed `main`). No manual `git worktree`, symlinks, or `.env` are involved.
- **`plan-agent` and `review-agent` are read-only on source** (`disallowedTools: Edit`); they only read code and write to GitHub via `gh`.

### Why background dispatch needs care

Background subagents **auto-deny any tool call that would otherwise prompt** (they cannot show a permission dialog), so a too-tight allowlist makes them stall silently — and, worse, improvise harmful workarounds (hand-edited lockfiles, abandoned libraries). We therefore **allow broad dev-command categories** (`gh`/`git`/`npm`) — with **`npx` scoped to `shadcn` only** (broad `npx` runs arbitrary packages, e.g. an interactive `npx vercel` login) — and use the **`deny`** list as the real safety surface for dangerous/interactive commands (merge, issue/repo delete, push-`main`, `npm publish`, `gh auth`, `npm login`/`adduser`, `vercel`). Deny beats allow at every scope. File edits are covered by each worker's `permissionMode: acceptEdits`. The worktree is a checkout of `main`, so it carries the committed `settings.json` — **permission changes take effect for dispatched agents only after they land on `main`.** Agents also run with **`disallowedTools: Agent`** (no nested subagents), a **`maxTurns`** backstop, and an explicit rule to **stop and emit `BLOCKED:` rather than improvise** when a command is denied.

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

| Label              | Set by                        | Type      | Meaning                                                                                   |
| ------------------ | ----------------------------- | --------- | ----------------------------------------------------------------------------------------- |
| `ready for review` | `impl-agent` / `revise-agent` | trigger   | Dispatch `review-agent`                                                                   |
| `reviewing`        | `review-agent`                | in-flight | Review underway                                                                           |
| `needs revision`   | `review-agent`                | trigger   | Dispatch `revise-agent` (subject to cycle cap)                                            |
| `revising`         | `revise-agent`                | in-flight | Fixes underway                                                                            |
| `approved`         | `review-agent`                | terminal  | Findings are at/under the current cycle's bar (escalating, below); human merges on GitHub |
| `needs human`      | Cockpit / `revise-agent`      | gate      | 5 cycles without convergence or rebase conflict; pipeline stops                           |

## Stages and models

| Stage        | Definition                       | Model                                     | Why                                                                  |
| ------------ | -------------------------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| Cockpit      | `.claude/skills/pipeline/`       | haiku (session)                           | Mechanical: queries, label swaps, dispatch, relaying                 |
| 0. Scope     | `.claude/skills/scope/`          | inherits session (opus/fable recommended) | Highest-leverage thinking; human is in the conversation              |
| 1. Plan      | `.claude/agents/plan-agent.md`   | **opus**                                  | Design-rich planning (UX/product spec); quality amplifies downstream |
| 2. Implement | `.claude/agents/impl-agent.md`   | sonnet                                    | Bulk of code volume; cost/quality sweet spot                         |
| 3. Review    | `.claude/agents/review-agent.md` | sonnet                                    | Must catch real issues reliably                                      |
| 4. Revise    | `.claude/agents/revise-agent.md` | sonnet                                    | Targeted fixes from a structured list                                |

All four workers read `.claude/docs/ENGINEERING.md` before working; the review agent treats it as a review dimension.

## Permission rationale

The model is **broad allow + authoritative deny**: stage agents do real dev work (install packages, read CI logs, manage git in their worktree), so the allowlist grants broad categories and the `deny` list draws the safety line. **Any permission change must update this section.**

| Allowed (`permissions.allow`)                                               | Used by             | Why                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Bash(gh *)`                                                                | all stages, cockpit | Issues/PRs/labels, the diff under review, CI status **and run logs** (`gh run view --log-failed`), `gh api` for version checks                                                                                                                                                                                     |
| `Bash(git *)`                                                               | impl, revise        | All git **inside the agent's own worktree** (fetch/checkout/rebase/commit/push/worktree) — no `git -C` on main                                                                                                                                                                                                     |
| `Bash(npm *)`                                                               | impl, revise        | `npm ci`, plus `npm install`/`uninstall`/`view` for dependency tickets                                                                                                                                                                                                                                             |
| `Bash(npx shadcn *)` + `Bash(npx shadcn@latest *)` + `Bash(npx shadcn@* *)` | impl, revise        | shadcn component CLI, **including version-pinned forms** (`npx shadcn@latest add … --yes`) — the bare `npx shadcn *` pattern doesn't match `shadcn@latest`. `npx` otherwise runs arbitrary packages; prettier/prisma/tsx go via `npm run`. Agents call the CLI directly (bare, in-place), **not** the shadcn Skill |
| `WebFetch(domain:nextjs.org \| ui.shadcn.com \| code.claude.com)`           | all stages          | Fetch current framework / Claude docs instead of stale recall                                                                                                                                                                                                                                                      |

File writes: source edits via each worker's `permissionMode: acceptEdits`; `.temp/` scratch payloads via an explicit `Edit(.temp/**)` / `Write(.temp/**)` allow, so **every** component — including the no-worktree read-only agents and the cockpit — writes its `--body-file` payloads and **posts its own comments** without prompts.

**Deny rules (`permissions.deny`) — the safety surface:** `gh pr merge` (the human merge gate is absolute), `gh issue delete`, `gh repo delete`, `gh auth`, pushes to `main` (`git push * main` / `git push origin main`), `npm publish`, `npm login`, `npm adduser`, and `npx vercel` / `vercel` (interactive-auth footgun). Deny beats allow at every scope, so these hold even with broad allows. _(Minor known gap: a `git push origin HEAD:main` refspec isn't caught by the `_ main`pattern — rely on the agent instruction + GitHub branch protection.)* Agents **may** edit CI workflow files and lockfiles (some tickets require it) but are instructed to use`npm`for dependencies and **not hand-edit`package.json`/`package-lock.json` as a workaround\*\*.

## Pipeline output formats

Defined once here; the stage agents follow these exactly.

### PR comments & reviews (review, revise, escalation; blockers on the issue)

The **code review is a real GitHub PR review** (`gh api …/pulls/<pr>/reviews --input`) — a summary body **plus inline line comments** on changed lines — not a plain comment. **Event:** `COMMENT` when the reviewer is the PR author (common case — same account; GitHub forbids `REQUEST_CHANGES`/`APPROVE` on your own PR), else `REQUEST_CHANGES` (Critical/Medium) or `APPROVE`. The pipeline **label** is the real control signal regardless. Revision summaries, escalations, and blockers use `gh … --body-file`.

- **Title (no emoji, cycle-numbered):** `## Code Review — Cycle <n>` · `## Revision Summary — Cycle <n>` · `## Pipeline Escalation` (and `## Blocker` on issues). `<n>` = prior review count + 1. Keep the literal `Code Review` text — the cockpit's cycle-cap counts it.
- **Provenance line** under the title: `_<stage> · PR #<pr> · against plan in #<issue>_`.
- **Findings** carry a **stable ID** (`R<cycle>-<sev><n>`) and a **clickable permalink to the exact line(s)**: ``[`path/file.ts:42`](https://github.com/SGAOperations/aplio/blob/<headRefOid>/path/file.ts#L42)`` (range `#L42-L48`); get `<headRefOid>` from `gh pr view <pr> --json headRefOid`.
- **Severity headers use colored circles:** `### 🔴 Critical` · `### 🟠 Medium` · `### 🟡 Low` · `### ⚪ Nit`. Each finding ends with **`Suggested fix:`** (+ an alternative where useful).
- **Escalating bar — what blocks rises with the review cycle** (so the first pass polishes everything and later passes converge): **cycle 1** any finding (incl. Nit) → `needs revision`; **cycle 2** Low+ blocks (Nit doesn't); **cycle 3+** Critical/Medium only. A nit introduced during a revision can't re-trigger at cycle ≥2. The cockpit cycle-cap (5 with Critical/Medium still open → `needs human`) is unchanged.
- **Later (delta) reviews** open with `### Resolved since last review` / `### Still open` (referencing prior IDs) before the new findings.
- **Inline-comment anchoring:** a `comments[]` entry is only accepted on a line **in the diff** — map it from `gh pr diff` hunk headers (added/context → `side:"RIGHT"`, new-version line number; deletions → `side:"LEFT"`, old-version line number). Findings off the diff go in the body as permalinks. If the reviews API still 422s ("Line could not be resolved"), **resubmit with `comments:[]`** (body only) so a review always lands. **Inline comments are NEW actionable findings only** — resolution/status ("resolved", "fixed", "still open") goes in the body's status sections, never as an inline comment.
- **Thread resolution (revise):** after pushing fixes, revise replies `Fixed in <sha> (R<c>-<id>)` to each addressed inline-comment thread and resolves it via GraphQL (`addPullRequestReviewThreadReply` + `resolveReviewThread`), matching threads to findings by ID; genuinely-skipped threads stay open. Keeps unresolved conversations from blocking merge.
- **Footer:** `_Posted by the agent pipeline._`

### PR description (impl writes it via `gh pr create --body-file`)

`Closes #N` · **## Summary** (what was built + approach) · **## Changes** (notable files/areas) · **## Testing plan** — reproducible **manual** steps as a `- [ ]` checklist a human runs before merge (setup → actions → expected results; happy-path + error/empty/edge + auth/roles; derived from the issue's Test/validation plan) · **## Automated checks** (prettier/eslint/tsc) · **## Notes** (schema/migrations, risks, follow-ups).

### Commit messages (impl, revise)

Write the message to `.temp/commit-msg.txt` and `git commit -F .temp/commit-msg.txt` — **never** inline multi-line `-m … -m …` (it collapses on Windows, dropping the subject and co-authorship). Format: subject `#N <imperative lowercase summary>` **< 80 chars, no trailing period**; optional short body only when the _why_ isn't obvious (blank line, wrap ~72, a few lines max); blank line; then the `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` trailer.

## Escalation

- **Review ↔ revise non-convergence** — before each revise dispatch the cockpit counts `## Code Review` comments; at 5 with Critical/Medium still found it labels `needs human`, comments, and stops dispatching for it.
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

| Symptom                                                                                           | Cause                                                                       | Fix                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Issue stuck in `planning` / `in progress`, PR stuck in `reviewing` / `revising`, no agent running | Agent crashed or session closed mid-flight                                  | `retry #N` in the cockpit — or re-apply the trigger label (`ready`, `plan approved`, `ready for review`, `needs revision`)                                                                                                                              |
| Nothing dispatches for an item                                                                    | It has no trigger label (paused, in-flight, or gated)                       | `status` shows where it is; `resume #N` re-applies the right trigger                                                                                                                                                                                    |
| A stage misbehaved and you want to run it by hand                                                 | —                                                                           | @-mention the subagent (`@agent-impl-agent implement #N`) or run `claude --agent impl-agent`                                                                                                                                                            |
| Cockpit session closed                                                                            | All state is in labels                                                      | Start `/pipeline` again; it resumes from the labels. `retry #N` anything parked in an in-flight label                                                                                                                                                   |
| Labels manually changed on GitHub                                                                 | Fine — labels are the source of truth                                       | The next tick acts on whatever the labels say                                                                                                                                                                                                           |
| Stale worktrees / orphan `node_modules` dirs accumulating under `.claude/worktrees/`              | Agents cut off mid-run; on Windows the harness leaves dirs git can't delete | Run **`/worktree-clean`** from the main checkout — it prunes registrations and force-deletes orphan dirs (`git worktree remove` alone fails with `Invalid argument` once `node_modules` exists). The cockpit reports these but never auto-deletes them. |
| An agent stopped with `BLOCKED:` or hit `maxTurns`                                                | Clean stop by design (not a crash)                                          | Resolve the blocker (or widen scope/permissions), then `retry #N`                                                                                                                                                                                       |

## Reading current state without the cockpit

```bash
gh issue list --repo SGAOperations/aplio --label "plan review"
gh issue list --repo SGAOperations/aplio --label "blocked"
gh pr list --repo SGAOperations/aplio --label "approved"
gh pr list --repo SGAOperations/aplio --label "needs human"
```
