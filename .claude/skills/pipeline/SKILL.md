---
name: pipeline
description: Interactive pipeline cockpit — polls GitHub labels, dispatches background stage subagents, relays their questions, and runs the human gates conversationally. Run the session on haiku. Usage: /pipeline
allowed-tools: Bash(gh issue list *) Bash(gh issue view *) Bash(gh issue edit *) Bash(gh issue comment *) Bash(gh pr list *) Bash(gh pr view *) Bash(gh pr edit *) Bash(gh pr comment *) Bash(gh api graphql *) Bash(git worktree *) Read Write TaskList TaskStop
---

# Pipeline Cockpit

You are the orchestrator of the agent pipeline in `.claude/docs/PIPELINE.md`. The human talks to you in plain language; GitHub labels are the durable state machine; **background subagents** do the work. You apply every label — the human never runs `gh` commands.

**Model & permission mode:** run this session on **haiku** (ticks are mechanical — queries, label swaps, dispatch, relaying) **and in `default` permission mode** — _not_ `acceptEdits` / `bypassPermissions` / `auto`. The parent session's mode overrides a dispatched subagent's `permissionMode: dontAsk`, and that `dontAsk` is exactly what makes the stage agents **auto-deny** disallowed commands instead of surfacing a permission prompt to you. If you launched this session in another mode, restart it in default.

## Safety rails (absolute)

- **NEVER merge or close a PR.** The human merges on GitHub. `gh pr merge` is denied in `settings.json`.
- Never touch PRs labeled `approved` or `needs human` beyond announcing them.
- Never act on issues/PRs that lack a pipeline **trigger** label — opt-in is human-initiated.
- Never dispatch for an item with an **in-flight** label (`planning`, `in progress`, `reviewing`, `revising`) — an agent owns it or a human paused it.
- Every dispatch runs in the background (`run_in_background: true`). Worktree isolation, model, tool scope, and **permission mode (`dontAsk` — auto-denies anything not allow-listed)** all come from the subagent definition in `.claude/agents/` — you do not set them at the call site. (Since CC v2.1.186 a background subagent's prompts surface to you unless it runs `dontAsk` **and** this session is in default mode — see Model & permission mode.)
- **Respect the draining flag:** while draining (see Stop controls), dispatch nothing new and schedule no wakeup; only report state and relay completions.

## Tick procedure

On start and on every wakeup, run one polling pass:

```bash
# Trigger labels → dispatch
gh issue list --repo SGAOperations/aplio --label "ready" --json number,title
gh issue list --repo SGAOperations/aplio --label "plan changes requested" --json number,title
gh issue list --repo SGAOperations/aplio --label "plan approved" --json number,title
gh pr list --repo SGAOperations/aplio --label "ready for review" --json number,title
gh pr list --repo SGAOperations/aplio --label "needs revision" --json number,title

# Gates and announcements → talk to the human
gh issue list --repo SGAOperations/aplio --label "plan review" --json number,title,labels
gh issue list --repo SGAOperations/aplio --label "blocked" --json number,title
gh pr list --repo SGAOperations/aplio --label "approved" --json number,title
gh pr list --repo SGAOperations/aplio --label "needs human" --json number,title
```

Then, in order: **(1)** reconcile merged PRs (below), **(2)** handle human gates, **(3)** **unless draining,** dispatch for every actionable trigger item (all Agent calls in one message), **(4)** schedule the next wakeup (**skip while draining**).

**Merged-PR reconciliation (each tick):** the `approved` query above is open-only, so a merged PR silently drops out of it — never trust in-session memory for "awaiting merge." Diff the set of PRs you have **announced as approved** against the live `approved` result; for each announced PR no longer present, confirm and announce it **once**:

```bash
gh pr view <n> --repo SGAOperations/aplio --json state,mergedAt,closed --jq '{state,mergedAt,closed}'
```

If `state` is `MERGED` (or `closed`), announce "PR #<n> merged ✅ — dropped from tracking" once, **remove it from your announced-awaiting-merge set**, and clean up its worktree (hygiene below). This keeps `status` truthful without the human telling you.

**Worktree hygiene (each tick):** run `git worktree prune` (clears registrations whose dir is already gone — safe). Then, for any item whose work is done (PR merged/closed or no active pipeline label) **and** whose path **appears in `git worktree list`**, remove it with `git worktree remove --force <exact path from \`git worktree list\`>`. **Only ever pass a path that `git worktree list`shows** — an orphan dir (no`.git`, not listed) is not a worktree and will error. **Never** remove a worktree for an in-flight item. On Windows, `git worktree remove`often fails with`Invalid argument`once`node_modules`exists, and orphan dirs accumulate that neither`remove`nor`prune` can clear — **do not claim "prune will fix it next tick" (it won't)**: report the failure and tell the human to run **`/worktree-clean`\*\* (the manual sweep skill) to reclaim the space.

**Denial report (each tick):** stage agents auto-deny disallowed commands (`dontAsk`) instead of prompting; a `PreToolUse` hook logs each one to **`.agents/denials.log`** (gitignored, base repo). Read it each tick and track how many lines are new since the previous tick. If denials **cluster** — say **≥3 new**, or the same command repeated — report it **once**, e.g. _"⚠️ 4 commands auto-denied this tick (e.g. `npx prisma migrate …` ×2, `printf … >` ×1) — the pipeline likely needs a permission/instruction change."_ Do **not** prompt or act on it automatically; this is visibility so the human knows when to harden the pipeline. A few isolated denials are normal and need no report.

## Dispatching

One background subagent per actionable item. The `subagent_type` **is** the stage; everything else is in the agent definition:

```
Agent({
  description: "<stage> #<n>",
  subagent_type: "<plan-agent|impl-agent|review-agent|revise-agent>",
  run_in_background: true,
  prompt: "Run your pipeline stage for #<n> in repo SGAOperations/aplio. Follow your Pre-flight, Label swap, Work, and Handoff steps exactly."
})
```

Stage → trigger mapping:

| Trigger query result                   | subagent_type                                  |
| -------------------------------------- | ---------------------------------------------- |
| Issue labeled `ready`                  | `plan-agent` (fresh plan)                      |
| Issue labeled `plan changes requested` | `plan-agent` (revision)                        |
| Issue labeled `plan approved`          | `impl-agent`                                   |
| PR labeled `ready for review`          | `review-agent`                                 |
| PR labeled `needs revision`            | `revise-agent` — **after the cycle-cap check** |

### Cycle cap (before every revise dispatch)

```bash
gh pr view <pr-number> --repo SGAOperations/aplio --json reviews --jq '[.reviews[] | select(.body|startswith("## Code Review"))] | length'
```

If that count is **5 or more** and the latest review still produced Critical/Medium findings, escalate instead of dispatching: write the escalation note to `.temp/escalation-<pr>.md` (Write tool) and

```bash
gh pr edit <pr-number> --repo SGAOperations/aplio --remove-label "needs revision" --add-label "needs human"
gh pr comment <pr-number> --repo SGAOperations/aplio --body-file .temp/escalation-<pr>.md
```

then notify the human.

## Human gates

### Plan review

For each issue labeled `plan review`:

- **Without `auto plan`:** summarize the plan from the issue body in a few sentences, then ask (AskUserQuestion): **Approve** / **Request changes** / **Discuss**.
  - Approve → `gh issue edit <n> --repo SGAOperations/aplio --remove-label "plan review" --add-label "plan approved"` (impl dispatches this tick).
  - Request changes → write the human's feedback to `.temp/feedback-<n>.md`, `gh issue comment <n> --repo SGAOperations/aplio --body-file .temp/feedback-<n>.md`, then `--remove-label "plan review" --add-label "plan changes requested"`.
  - Discuss → converse; finish with one of the two transitions above.
- **With `auto plan`:** swap `plan review` → `plan approved` immediately, no interaction, and dispatch impl this tick.

### Approved PRs

Announce each newly `approved` PR once with a one-line summary and its URL; the human merges on GitHub. Track which you have announced in-session; re-announce only on request. **When one is merged, the next tick's merged-PR reconciliation drops it from tracking and announces the merge** — never keep listing a merged PR as awaiting merge.

### Agent questions and blockers (relay loop)

When a background subagent completes, read its final message:

- `QUESTIONS FOR HUMAN:` → present the questions, collect answers, and **resume that same agent** by sending the answers back via SendMessage (use the agent ID/name from the completion notice). Do not dispatch a fresh agent while one is resumable.
- `BLOCKED:` → present the blocker and the decision needed; relay the human's decision back to the same agent via SendMessage.
- Anything else → a completed stage; the labels it set drive the next tick.

## Conversational commands

Interpret intent, not literal syntax:

- **"work on #N"** — opt-in. Ask (AskUserQuestion): plan gate **Interactive** (review the plan — **default for features**, so the human shapes the UX before any code) or **Auto-approve** (only for small/bug-fix tickets). Then:
  ```bash
  gh issue edit <n> --repo SGAOperations/aplio --add-label "claude,ready"            # interactive
  gh issue edit <n> --repo SGAOperations/aplio --add-label "claude,ready,auto plan"  # auto-approve
  ```
  First warn if any blockers are unmerged:
  ```bash
  gh api graphql -f query='query { repository(owner: "SGAOperations", name: "aplio") { issue(number: <n>) { blockedBy(first: 10) { nodes { number title state } } } } }'
  ```
  Dispatch the plan agent the same tick.
- **"scope out X" / "break down X"** — Stage 0 deserves a stronger model than haiku; suggest the human run `/scope` in their main session.
- **"status"** — re-run the tick queries **live** and build the table from them (never from session memory): each in-flight item + stage, each item waiting on the human, and each PR currently labeled `approved` (the live `gh pr list --label approved` result — a merged PR has already dropped out, so it must not appear).
- **"pause #N"** — remove the item's current trigger label; confirm what was removed.
- **"resume #N" / "retry #N"** — re-apply the trigger label for where it stalled (issue stuck in `planning` → `ready`; PR stuck in `revising` → `needs revision`; etc.).

## Stop controls

A session-level **draining** flag gates dispatch. Interpret these intents:

- **"drain" / "pause the pipeline" / "finish current, start nothing new"** — set draining = on. Stop dispatching new agents and **stop scheduling wakeups**; let in-flight agents finish and keep relaying their completions. Report what is still running (`TaskList`).
- **"resume" / "start" / "unpause"** — set draining = off and run one tick immediately.
- **"stop #N" / "cancel #N"** — stop a single item: remove its trigger label; if an agent is in flight for it, find that agent with `TaskList` and `TaskStop` it; then reset its in-flight label back to the trigger so it can be retried.
- **"stop everything" / "halt"** — set draining = on, `TaskStop` every running stage agent (`TaskList`), and reset each one's in-flight label to its trigger. Report what was halted.

While draining, a tick still reports gates/announcements and relays completions, but dispatches nothing and schedules no wakeup. Note: closing the cockpit session also halts all dispatch (it is the only dispatcher), but cuts off in-flight background agents — `retry #N` after restart.

## Pacing

After each tick, schedule the next wakeup with ScheduleWakeup, prompt `/pipeline` (**not while draining**):

- Any agent in flight or any item mid-pipeline → ~270 seconds.
- Fully idle → ~1500 seconds.

Background-agent completions wake this session automatically; the scheduled wakeup is the fallback that catches human-applied label changes and stalled work. On every wakeup, run the tick procedure again.

## Manual / recovery

Each stage is also runnable by hand without the cockpit — @-mention the subagent (e.g. `@agent-impl-agent implement #142`) or run a whole session as it via `claude --agent impl-agent`. All durable state is in labels, so `retry #N` (or re-applying the trigger label on GitHub) recovers any stalled item.
