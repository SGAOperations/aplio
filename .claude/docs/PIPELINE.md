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
- **`impl-agent` and `revise-agent` get their own isolated git worktree** — a fresh checkout where they `npm ci` + `npm run prisma:generate`, do the work, and push a feature branch. impl branches from `main`; **revise rebases onto the PR's base branch** (`baseRefName`, not assumed `main`), autonomously resolving structurally unambiguous conflicts and escalating only ambiguous ones (see "Rebase conflict protocol"). No manual `git worktree`, symlinks, or `.env` are involved.
- **`plan-agent` and `review-agent` are read-only on source** (`disallowedTools: Edit`); they only read code and write to GitHub via `gh`.

### Why background dispatch needs care

A non-allow-listed command must **auto-deny** (never prompt the human), or every stray command interrupts the operator. **Important version note:** **before CC v2.1.186** background subagents auto-denied prompts on their own; **as of v2.1.186 they no longer do — the prompt surfaces in the human's session.** We therefore make the stage agents run **`permissionMode: dontAsk`** (auto-deny anything not on the allow list, no prompt) and require the **cockpit session to run in `default` mode** — a parent in `acceptEdits`/`bypass`/`auto` overrides the subagent's `dontAsk`. Because `dontAsk` only runs allow-listed actions, the allow list also grants **`Edit(**)`/`Write(**)`** so impl/revise can edit source (replacing the old reliance on `acceptEdits`).

We **allow broad dev-command categories** (`gh`/`git`/`npm`) — with **`npx` scoped to `shadcn` only** (broad `npx` runs arbitrary packages, e.g. an interactive `npx vercel` login; prettier/prisma/tsx go via `npm run`) — and use the **`deny`** list as the real safety surface for dangerous/interactive commands (merge, issue/repo delete, push-`main`, `npm publish`, `gh auth`, `npm login`/`adduser`, `vercel`). Deny beats allow at every scope. The worktree is a checkout of `main`, so it carries the committed `settings.json` — **permission changes take effect for dispatched agents only after they land on `main`.** Agents also run with **`disallowedTools: Agent`** (no nested subagents), a **`maxTurns`** backstop, and the rule to **stop and emit `BLOCKED:` (with the denied command) rather than improvise** when a command is auto-denied.

**Denial visibility:** a `PreToolUse` Bash hook (`.claude/hooks/log-bash-denial.mjs`) appends every non-allow-listed command to a gitignored `.agents/denials.log`; the cockpit reads it each tick and reports clusters (so systemic denials are visible without prompting). Logging-only — it never blocks; `dontAsk` does the denying.

### File-based GitHub I/O

Agents never pass large markdown (plans, reviews, comments) as an inline `--body "..."` argument — shell quoting of backticks/code-fences fails cross-platform. They write the payload to `.temp/` (gitignored) and use `gh ... --body-file`. The same applies to the cockpit's escalation comments.

### Operating rules (all stage agents)

Canonical rules every stage agent follows — each agent file points here and restates only its specifics. A Bash command matches the `permissions.allow` list only if it **starts with an allowlisted binary AND parses cleanly**; otherwise it falls through to a prompt that a background agent auto-denies.

- **Inspect with tools, not the shell** — Read / Grep / Glob for all file reading, searching, and listing; **never** `cat`/`head`/`tail`/`grep`/`find`/`ls` nor `python3`/`node -e`/`awk`/`sed`/`wc` (not allow-listed by design — a denial means _use the tool_, not retry). Scope Glob to source dirs; prefer Grep (gitignore-aware, skips `node_modules`) over a root-level `**/*`.
- **Run commands bare** — no `cd … && …` and no `ENV=val cmd` prefix (both move the start token off the binary; `GIT_EDITOR=true git …` misses `Bash(git *)`). For a non-interactive git editor use `git -c core.editor=true …`.
- **Quote every path argument** — route groups `(…)` and dynamic segments `[…]` are shell-special; use cwd-relative paths with forward slashes, never an absolute `C:\…` / `/c/…` or base-repo path. `git add -A` avoids enumerating them.
- **Write files with the Write/Edit tools** at cwd-relative paths — never shell redirection (`cat >`, `printf >`, `echo >`, heredocs). Delete tracked files with `git rm`.
- **GitHub I/O is file-based** — large markdown goes to `.temp/` (gitignored) via `gh … --body-file`/`--input`, never inline `--body "…"`. Extract data with `gh … --json … --jq '…'`, never piped to an interpreter.
- **When auto-denied, stop — don't improvise.** A denied command just errors (no prompt, under `dontAsk`). Don't retry or route around it: **emit `BLOCKED: <exact denied command + what you needed>`** so the cockpit surfaces it. Never spawn subagents.

Documented once here so the rationale isn't re-debugged; agent files restate only the rules unique to them.

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

| Label              | Set by                        | Type      | Meaning                                                                                          |
| ------------------ | ----------------------------- | --------- | ------------------------------------------------------------------------------------------------ |
| `ready for review` | `impl-agent` / `revise-agent` | trigger   | Dispatch `review-agent`                                                                          |
| `reviewing`        | `review-agent`                | in-flight | Review underway                                                                                  |
| `needs revision`   | `review-agent`                | trigger   | Dispatch `revise-agent` (subject to cycle cap)                                                   |
| `revising`         | `revise-agent`                | in-flight | Fixes underway                                                                                   |
| `approved`         | `review-agent`                | terminal  | Findings are at/under the current cycle's bar (escalating, below); human merges on GitHub        |
| `needs human`      | Cockpit / `revise-agent`      | gate      | 5 cycles without convergence, or an ambiguous rebase conflict needing the author; pipeline stops |

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
| `Edit(**)` + `Write(**)`                                                    | impl, revise        | Edit/create source files. **Required** because the agents run `permissionMode: dontAsk`, under which file edits are not auto-accepted and must be explicitly allow-listed (read-only plan/review keep `disallowedTools: Edit`). Subsumes the old `.temp/**` allow.                                                 |
| `WebFetch(domain:nextjs.org \| ui.shadcn.com \| code.claude.com)`           | all stages          | Fetch current framework / Claude docs instead of stale recall                                                                                                                                                                                                                                                      |

Permission mode: every stage agent runs **`permissionMode: dontAsk`** (auto-deny non-allow-listed commands, no prompt). The **cockpit must run in `default` mode** or it overrides that. Hook: a `PreToolUse` Bash hook (`log-bash-denial.mjs`) logs auto-denied commands to `.agents/denials.log` for the cockpit to surface — logging-only, never blocks.

**Deny rules (`permissions.deny`) — the safety surface:** `gh pr merge` (the human merge gate is absolute), `gh issue delete`, `gh repo delete`, `gh auth`, pushes to `main` (`git push * main` / `git push origin main`), `npm publish`, `npm login`, `npm adduser`, and `npx vercel` / `vercel` (interactive-auth footgun). Deny beats allow at every scope, so these hold even with broad allows. _(Minor known gap: a `git push origin HEAD:main` refspec isn't caught by the `_ main`pattern — rely on the agent instruction + GitHub branch protection.)* Agents **may** edit CI workflow files and lockfiles (some tickets require it) but are instructed to use`npm`for dependencies and **not hand-edit`package.json`/`package-lock.json` as a workaround\*\*.

## Pipeline output formats

Defined once here; the stage agents follow these exactly.

### Writing style (every output)

Every plan, review, summary, and comment is written for a human scanning fast:

- **Bullets and short sentences over paragraphs** — one idea per bullet.
- **Never restate context the reader already has** (the ticket, a prior review, the diff) — reference it.
- **Omit empty sections** — no "N/A" / "Not applicable" / "None" filler; if a section doesn't apply, leave it out.
- **No meta-commentary** — don't describe the document itself ("This section records…", "For completeness…").
- **Say it once** — never repeat a point across sections, or across body + inline + summary.

### Implementation plan (plan-agent writes it into the issue body)

Appended below the ticket under a `---` then `## Implementation Plan`; revision mode replaces only that block. **Do not restate the ticket** — reference it. Fixed sections in this order; the conditional ones appear **only when they apply** (omit otherwise — no stub):

- **## Overview** — 2–4 sentences: what, why, the approach.
- **## Changes** — files to create/modify, one bullet each: `` `path` — one-line reason ``.
- **## Implementation** — ordered `- [ ]` checkboxes, one line each; fold validation / states / error-model notes into the step they belong to.
- **## Data & contracts** _(only if schema or server actions change)_ — Prisma changes; per action: zod + auth scoping and the exact `{ error: '…' }` copy vs. throw (§4 decision test).
- **## UX states** _(only if there's UI)_ — loading / empty / error + key copy, as bullets.
- **## Testing** — human-runnable manual steps as `- [ ]` (feeds the PR Testing plan).
- **## Risks / notes** _(optional)_ — only real, non-obvious ones.

Most plans fit on one screen. No "Nature of this ticket" preamble, no restated Goal/Files, no N/A sections.

### PR reviews & revisions

The **code review is a real GitHub PR review** (`gh api …/pulls/<pr>/reviews --input`): **inline line comments carry the findings**; the body is a one-line verdict. **Event:** `COMMENT` when the reviewer is the PR author (common case — same account; GitHub forbids `REQUEST_CHANGES`/`APPROVE` on your own PR), else `REQUEST_CHANGES` (Critical/Medium) or `APPROVE`. The pipeline **label** is the real control signal regardless.

**Findings live on the threads, not in a summary.** A resolved review thread _is_ the log entry — collapsed and out of the way until expanded. So a finding is never re-narrated cycle after cycle, and "what's still open" is GitHub's unresolved-conversation count.

- **Review body = title + one line.** `## Code Review — Cycle <n> · <verdict>` (keep the literal `Code Review` — the cockpit cycle-cap counts it; `<verdict>` = `needs revision`/`approved`; `<n>` = prior review count + 1), then a single counts line, e.g. `2 open — 1 🔴 Critical, 1 🟠 Medium (see inline)`. Nothing else — no per-finding list, no provenance line, no footer, no Resolved/Still-open sections (thread state is the truth). **Only exception:** a finding that can't anchor to a diff line (architectural / off-diff) has no thread, so it goes in the body with a `blob/<headRefOid>` permalink (get `<headRefOid>` from `gh pr view <pr> --json headRefOid`).
- **Each finding = one inline comment** on a diff line: `**R<n>-<sev><id>** <emoji> — <problem>. Fix: <one line>.` Stable ID `R<cycle>-<sev><id>` (e.g. `R2-M1`); severities 🔴 Critical · 🟠 Medium · 🟡 Low · ⚪ Nit. Inline comments are **new actionable findings only** — never status ("fixed"/"still open").
- **Escalating bar — what blocks rises with the cycle** (pass 1 polishes everything, later passes converge): **cycle 1** any finding → `needs revision`; **cycle 2** Low+ blocks (Nit doesn't); **cycle 3+** Critical/Medium only. A nit introduced during a revision can't re-trigger at cycle ≥2. Cockpit cycle-cap (5 with Critical/Medium still open → `needs human`) unchanged.
- **Inline anchoring:** a `comments[]` entry is accepted only on a line **in the diff** — map it from `gh pr diff` hunk headers (added/context → `side:"RIGHT"`, new-version line; deletions → `side:"LEFT"`, old-version line). If the reviews API 422s ("Line could not be resolved"), **resubmit with `comments:[]`** (body only) and list those findings in the body with permalinks, so a review always lands.
- **Revision — resolve threads, don't summarize.** After pushing fixes, for each finding **fixed**: reply `Fixed in <sha>` on its thread and resolve it via GraphQL (`addPullRequestReviewThreadReply` + `resolveReviewThread`), matched by ID; **genuinely-skipped** threads get a one-line reason and stay open. Then one short PR comment per cycle (or none): `## Revision — Cycle <n>` + a single line `fixed <ids> · skipped <ids> · <sha>` (append `· rebase: <file> (<strategy>)` if a conflict was auto-resolved). No Fixed/Skipped/Preexisting sections. A preexisting issue worth tracking → a one-line `follow-up:` note or a new issue, not a summary block.
- **Other comments:** `## Pipeline Escalation` (revise — ambiguous rebase) and `## Blocker` (impl — on the issue) stay short: what's blocked + the decision needed, via `--body-file`.

### PR description (impl writes it via `gh pr create --body-file`)

`Closes #N` · **## Summary** (what was built + approach) · **## Changes** (notable files/areas) · **## Testing plan** — reproducible **manual** steps as a `- [ ]` checklist a human runs before merge (setup → actions → expected results; happy-path + error/empty/edge + auth/roles; derived from the issue's Test/validation plan) · **## Automated checks** (prettier/eslint/tsc) · **## Notes** (schema/migrations, risks, follow-ups).

### Commit messages (impl, revise)

Write the message to `.temp/commit-msg.txt` and `git commit -F .temp/commit-msg.txt` — **never** inline multi-line `-m … -m …` (it collapses on Windows, dropping the subject and co-authorship). Format: subject `#N <imperative lowercase summary>` **< 80 chars, no trailing period**; optional short body only when the _why_ isn't obvious (blank line, wrap ~72, a few lines max); blank line; then the `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` trailer.

## Escalation

- **Review ↔ revise non-convergence** — before each revise dispatch the cockpit counts `## Code Review` comments; at 5 with Critical/Medium still found it labels `needs human`, comments, and stops dispatching for it.
- **Impl blocker** — `impl-agent` comments `## Blocker`, labels `blocked`, and reports `BLOCKED:`; the cockpit relays and resumes the same agent with the human's decision.
- **Rebase conflict during revision** — `revise-agent` attempts autonomous resolution per the **Rebase conflict protocol** below; it aborts, comments with a `## Pipeline Escalation`, and labels `needs human` **only** when a conflict is ambiguous/semantic (or on the never-touch list).

### Rebase conflict protocol (for `revise-agent`)

When `git rebase origin/<base>` hits conflicts, `revise-agent` resolves the structurally unambiguous ones itself and escalates the rest. **Fail closed:** if any single conflict is ambiguous or on the never-touch list, abort the **entire** rebase and escalate — never partially resolve, and never let an auto-resolve silently drop a side's logic.

1. **Inspect conflicts** — run `git diff --name-only --diff-filter=U` to list conflicted files. For each file, read the conflict markers (via the Grep/Read tools — `<<<<<<<`).

2. **Classify each conflict:**

   | Auto-resolvable ✓                                                                                                      | Escalate ✗                                                                            |
   | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
   | Our changes and theirs are in clearly separate sections of the file (non-overlapping line ranges within the same hunk) | Both sides modified the same function body, same expression, or same schema field     |
   | `package-lock.json` or other generated/lockfile conflicts                                                              | Prisma migration files (`prisma/migrations/**/*.sql`) — never auto-resolve migrations |
   | Theirs added a new import / export; ours added a different one; no line overlap                                        | Type definitions or constants where both sides changed the same key                   |
   | Theirs made a whitespace/formatting-only change in our area                                                            | Logic changes on the same lines from both sides                                       |
   | One side deleted a block entirely that the other side didn't touch                                                     | Any conflict where accepting one side would silently drop the other's logic           |

3. **If all conflicts are auto-resolvable:**
   - Resolve each conflict (pick ours, pick theirs, or merge cleanly) with the Edit/Write tools — removing every conflict marker — then `git add "<path>"` (quoted), then `git -c core.editor=true rebase --continue` (non-interactive; never a bare `--continue` that may open an editor). For `package-lock.json`, prefer taking the base's lockfile and re-running `npm ci` over hand-merging JSON. A rebase may pause repeatedly — re-run this protocol for any new conflicts each pause.
   - In the revision summary comment, list each resolved file and state the resolution strategy used (e.g. "accepted both imports", "kept ours — their change was whitespace-only").

4. **If any conflict is ambiguous/semantic:**
   - `git rebase --abort` immediately (abort the whole rebase — do not leave a half-rebased state).
   - Comment on the PR with a `## Pipeline Escalation` section that:
     - Lists each conflicting file and the specific hunks that are ambiguous.
     - Describes both sides of each conflict.
     - States why autonomous resolution was not safe.
   - Label the issue `needs human` and stop.

5. **Never** auto-resolve conflicts in (escalate regardless of apparent simplicity):
   - Prisma migration files (`prisma/migrations/**/*.sql`)
   - `CLAUDE.md` or any `.claude/docs/` file
   - Environment config (`.env*`, `next.config.*`)

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
