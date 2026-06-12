# Agent Pipeline

This repo uses a Claude Code agent pipeline to take GitHub Issues from idea to merge-ready PR with minimal human intervention. A single `/pipeline` session is the human's cockpit: it polls GitHub, dispatches background agents, relays their questions, and applies every label. Humans converse; they never need to run `gh` commands. GitHub labels remain the durable state machine, so progress is always visible on GitHub and manual intervention always works.

## Quick start

```
claude        # open a session (haiku recommended for the cockpit)
/pipeline     # start the cockpit
```

Then talk to it: `work on #142` · `scope out a notifications feature` · `status` · `pause #142` · `retry #142`.

## The two flows

### Major feature

| Step | You (in the cockpit) | Behind the scenes |
| --- | --- | --- |
| 1. Describe | "scope out X" — short conversation about what you want | `/scope` creates the epic + sub-tickets, linked and dependency-ordered |
| 2. Start | "work on #N" + choose: review the plan myself, or auto-approve | Plan agent researches the codebase and writes a plan into the issue; its questions pop up in your terminal |
| 3. Approve plan | Read the summary, approve — or give feedback (it revises and comes back) | Impl agent builds in an isolated worktree, runs CI checks, opens a PR; review and revise agents loop until clean (max 3 rounds, then it flags you) |
| 4. Merge | Click merge on GitHub | Issue closes automatically |

### Bug fix

File the issue → in the cockpit: "work on #N, auto-approve the plan" → wait → merge on GitHub. The plan gate is skipped (`auto plan` label); the merge gate never is.

## Label lifecycle

Rule: **every stage agent's first action is swapping its trigger label for its in-flight label.** Absence of a trigger label means the cockpit skips the item — a tick can never double-dispatch. A crashed agent leaves the item parked in an in-flight label; recovery = re-apply the trigger label (`retry #N` in the cockpit).

### Issue labels

| Label                    | Set by                                   | Type      | Meaning                                          |
| ------------------------ | ---------------------------------------- | --------- | ------------------------------------------------ |
| `claude`                 | Cockpit (at opt-in)                      | marker    | Claude is handling this ticket                   |
| `ready`                  | Cockpit (at opt-in)                      | trigger   | Dispatch plan agent                              |
| `planning`               | Plan agent                               | in-flight | Plan being researched/written                    |
| `plan review`            | Plan agent                               | gate      | Plan written — awaiting human approval in cockpit |
| `plan changes requested` | Cockpit (human feedback)                 | trigger   | Dispatch plan agent in revision mode             |
| `plan approved`          | Cockpit (human approval, or `auto plan`) | trigger   | Dispatch impl agent                              |
| `auto plan`              | Cockpit (at opt-in)                      | marker    | Plan gate skipped: `plan review` auto-approved   |
| `in progress`            | Impl agent                               | in-flight | Implementation underway                          |
| `pr opened`              | Impl agent                               | terminal  | PR open; remaining state tracked on the PR       |
| `blocked`                | Impl agent                               | gate      | Needs human decision; details in issue comment   |

### PR labels

| Label              | Set by                    | Type      | Meaning                                                       |
| ------------------ | ------------------------- | --------- | ------------------------------------------------------------- |
| `ready for review` | Impl agent / revise agent | trigger   | Dispatch review agent                                          |
| `reviewing`        | Review agent              | in-flight | Review underway                                                |
| `needs revision`   | Review agent              | trigger   | Dispatch revise agent (subject to cycle cap)                   |
| `revising`         | Revise agent              | in-flight | Fixes underway                                                 |
| `approved`         | Review agent              | terminal  | Only Low/Nit findings; human merges on GitHub                  |
| `needs human`      | Cockpit / revise agent    | gate      | 3 cycles without convergence or rebase conflict; pipeline stops |

## Stages and models

| Stage | Skill | Model | Why |
| --- | --- | --- | --- |
| Cockpit | `.claude/skills/pipeline/` | haiku (session) | Mechanical: queries, label swaps, dispatch, relaying |
| 0. Scope | `.claude/skills/scope/` | inherits session (opus/fable recommended) | Highest-leverage thinking; human is in the conversation |
| 1. Plan | `.claude/skills/plan-agent/` | sonnet (opus on request) | Research + writing; plan quality amplifies downstream |
| 2. Implement | `.claude/skills/impl-agent/` | sonnet | Bulk of code volume; cost/quality sweet spot |
| 3. Review | `.claude/skills/review-agent/` | sonnet | Must catch real issues reliably |
| 4. Revise | `.claude/skills/revise-agent/` | sonnet | Targeted fixes from a structured list |

Every background dispatch sets `isolation: "worktree"` (required for background agents to have write access on this machine — `settings.json` permissions do not propagate to background sub-agents) and an explicit `model`.

All agents read `ENGINEERING.md` before working; the review agent treats it as a review dimension.

## Permission rationale

Every entry in `.claude/settings.json` → `permissions.allow`, what uses it, and why. **Any permission change must update this table.**

| Permission | Used by | Why |
| --- | --- | --- |
| `Bash(gh issue view *)` | all stages | Read issue bodies (plans live there), labels, comments |
| `Bash(gh issue edit *)` | cockpit, plan, impl | Label transitions; plan written into the issue body |
| `Bash(gh issue comment *)` | plan, impl | Blocker comments, plan feedback threads |
| `Bash(gh issue create *)` | scope | Create epics and sub-issues |
| `Bash(gh issue list *)` | cockpit | Tick queries over trigger/gate labels |
| `Bash(gh pr list *)` | cockpit, review, revise | Tick queries; resolve issue number → PR |
| `Bash(gh pr view *)` | cockpit, review, revise | PR metadata, labels, comments (cycle cap counts reviews) |
| `Bash(gh pr diff *)` | review | The diff under review |
| `Bash(gh pr comment *)` | cockpit, review, revise | Review comments, revision summaries, escalations |
| `Bash(gh pr edit *)` | cockpit, impl, review, revise | PR label transitions |
| `Bash(gh pr create *)` | impl | Open the PR |
| `Bash(gh pr checks *)` | review | CI status feeds the review verdict |
| `Bash(gh label create *)` | setup | Create/repair pipeline labels |
| `Bash(gh api repos/SGAOperations/aplio/*)` | scope | Sub-issue linking (REST, database ids) — scoped to this repo only |
| `Bash(gh api graphql *)` | scope, cockpit | Blocker relationships; blocked-by checks at opt-in |
| `Bash(git fetch *)`, `Bash(git worktree *)`, `Bash(git checkout *)` | impl, revise | Create/resume per-ticket worktrees in `.worktrees/` |
| `Bash(git add/commit/push *)` and `Bash(git -C * …)` variants | impl, revise | Commit and push inside worktrees (`git -C` per repo convention) |
| `Bash(ln -s *)` | impl, revise | Symlink `node_modules`/`.env` into worktrees |
| `Bash(mkdir *)` | impl, revise | Worktree/scaffold directories |
| `Bash(npm run prettier:check)`, `Bash(npx prettier --write *)`, `Bash(npm run eslint:check)`, `Bash(npm run tsc:check)` | impl, revise | The three pre-push CI checks |
| `additionalDirectories: .worktrees` | impl, revise | File write access inside per-ticket worktrees |

**Deliberately excluded:** `gh pr merge` (the human merge gate is absolute), `gh issue delete`, `gh repo *`. Force pushes: only `--force-with-lease` on feature branches after a rebase, never on `main` (covered by the push patterns above; the rule lives in the revise agent and global git conventions).

## Escalation

- **Review ↔ revise non-convergence** — before each revise dispatch the cockpit counts `## Code Review` comments; at 3 with Critical/Medium still found it labels `needs human`, comments on the PR, and stops dispatching for it.
- **Impl blocker** — the impl agent comments `## Blocker` on the issue, labels `blocked`, and reports back; the cockpit relays it and can resume the same agent with your decision.
- **Rebase conflict during revision** — the revise agent aborts the rebase, comments on the PR, labels `needs human`.
- **Plan questions** — the plan agent never guesses: it returns `QUESTIONS FOR HUMAN:` and the cockpit relays, then resumes it with your answers.

## Recovery runbook

| Symptom | Cause | Fix |
| --- | --- | --- |
| Issue stuck in `planning` / `in progress`, PR stuck in `reviewing` / `revising`, no agent running | Agent crashed or session was closed mid-flight | `retry #N` in the cockpit — or manually re-apply the trigger label (`ready`, `plan approved`, `ready for review`, `needs revision`) |
| Nothing dispatches for an item | It has no trigger label (paused, in-flight, or gated) | `status` in the cockpit shows where it is; `resume #N` re-applies the right trigger |
| A stage misbehaved and you want to run it by hand | — | The per-stage skills are directly invocable: `/plan-agent N`, `/impl-agent N`, `/review-agent N`, `/revise-agent N` |
| Cockpit session closed | All state is in labels | Start `/pipeline` again; it picks up exactly where things stood. In-flight background agents were cut off — `retry #N` anything parked in an in-flight label |
| Labels manually changed on GitHub | Fine — labels are the source of truth | The next tick acts on whatever the labels say |

## Reading current state without the cockpit

```bash
gh issue list --repo SGAOperations/aplio --label "plan review"
gh issue list --repo SGAOperations/aplio --label "blocked"
gh pr list --repo SGAOperations/aplio --label "approved"
gh pr list --repo SGAOperations/aplio --label "needs human"
```
