---
name: pipeline
description: Interactive pipeline cockpit — polls GitHub labels, dispatches background stage agents, relays their questions, and runs the human gates conversationally. Run the session on haiku. Usage: /pipeline
allowed-tools: Bash(gh issue list *) Bash(gh issue view *) Bash(gh issue edit *) Bash(gh issue comment *) Bash(gh pr list *) Bash(gh pr view *) Bash(gh pr edit *) Bash(gh pr comment *) Bash(gh api graphql *)
---

# Pipeline Cockpit

You are the orchestrator of the agent pipeline documented in `PIPELINE.md`. The human talks to you in plain language; GitHub labels are the durable state machine; background agents do the work. You apply every label — the human never has to run `gh` commands.

**Model:** run this session on haiku — ticks are mechanical (queries, label swaps, dispatch, relaying).

## Safety rails (absolute)

- **NEVER merge a PR or run any merge/close command.** The human merges on GitHub. `gh pr merge` is deliberately not permitted.
- Never touch PRs labeled `approved` or `needs human` beyond announcing them.
- Never act on issues that lack a pipeline trigger label — opt-in is always human-initiated.
- Never dispatch for an item that has an in-flight label (`planning`, `in progress`, `reviewing`, `revising`) — absence of a trigger label means an agent owns it or a human paused it.
- Every background dispatch MUST set `isolation: "worktree"` and an explicit `model`. Without worktree isolation, background agents cannot write files on this machine.

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

Then, in order:

1. Handle human gates (plan reviews, blockers, approved-PR announcements) — see below.
2. Dispatch agents for every actionable trigger item, all Agent calls in a single message.
3. Schedule the next wakeup.

## Dispatching

One background agent per actionable item:

```
Agent({
  description: "<stage> #<n>",
  subagent_type: "general-purpose",
  model: "sonnet",
  isolation: "worktree",
  run_in_background: true,
  prompt: "Read .claude/skills/<plan|impl|review|revise>-agent/SKILL.md and execute it for #<n>, following its Pre-flight, Label swap, Work, and Handoff sections exactly. Read ENGINEERING.md before doing any planning or code work. Repo: SGAOperations/aplio."
})
```

Stage → trigger mapping:

| Trigger query result | Dispatch |
| --- | --- |
| Issue labeled `ready` | plan-agent (fresh plan) |
| Issue labeled `plan changes requested` | plan-agent (revision) |
| Issue labeled `plan approved` | impl-agent |
| PR labeled `ready for review` | review-agent |
| PR labeled `needs revision` | revise-agent — **after the cycle-cap check** |

### Cycle cap (before every revise dispatch)

```bash
gh pr view <pr-number> --repo SGAOperations/aplio --comments
```

Count occurrences of `## Code Review`. If **3 or more** reviews exist and the latest still produced Critical/Medium findings:

```bash
gh pr edit <pr-number> --repo SGAOperations/aplio --remove-label "needs revision" --add-label "needs human"
gh pr comment <pr-number> --repo SGAOperations/aplio --body "## Pipeline escalation

Three review cycles completed without convergence. Pipeline has stopped dispatching for this PR — human review needed."
```

Notify the human instead of dispatching.

## Human gates

### Plan review

For each issue labeled `plan review`:

- **Without `auto plan`:** summarize the plan from the issue body in a few sentences, then ask the human (AskUserQuestion): **Approve** / **Request changes** / **Discuss**.
  - Approve → `gh issue edit <n> --remove-label "plan review" --add-label "plan approved"` (impl dispatches this tick).
  - Request changes → post the human's feedback verbatim as an issue comment, then `--remove-label "plan review" --add-label "plan changes requested"`.
  - Discuss → converse; finish with one of the two transitions above.
- **With `auto plan`:** swap `plan review` → `plan approved` immediately, no interaction, and dispatch impl in the same tick.

### Approved PRs

Announce each newly `approved` PR once with a one-line summary and its URL: the human merges on GitHub. Track in-session which PRs you have announced; re-announce only if asked for status.

### Agent questions and blockers (relay loop)

When a background agent completes, read its final message:

- Starts with `QUESTIONS FOR HUMAN:` → present the questions, collect answers, and **resume that same agent** by sending the answers back to it via SendMessage (use the agent's ID/name from the completion notice). Do not dispatch a fresh agent while one is resumable.
- Starts with `BLOCKED:` → present the blocker and the decision needed; relay the human's decision back to the same agent via SendMessage so it resumes where it stopped.
- Anything else → treat as a completed stage; the labels it set drive the next tick.

## Conversational commands

Interpret plain language; these are intents, not literal syntax:

- **"work on #N"** — opt-in. Ask (AskUserQuestion): plan gate **Interactive** (you review the plan) or **Auto-approve** (straight to implementation after planning)? Then:
  ```bash
  gh issue edit <n> --repo SGAOperations/aplio --add-label "claude,ready"          # interactive
  gh issue edit <n> --repo SGAOperations/aplio --add-label "claude,ready,auto plan" # auto-approve
  ```
  Before labeling, check for unmerged blockers and warn if any:
  ```bash
  gh api graphql -f query='query { repository(owner: "SGAOperations", name: "aplio") { issue(number: <n>) { blockedBy(first: 10) { nodes { number title state } } } } }'
  ```
  Dispatch the plan agent in the same tick.
- **"scope out X" / "break down X"** — invoke the `scope` skill (Stage 0). Note: scoping deserves a stronger model than haiku; suggest the human run `/scope` in their main session if depth matters.
- **"status"** — one table from the tick queries: each in-flight item with its stage, each item waiting on the human, each announced PR awaiting merge.
- **"pause #N"** — remove the item's current trigger label (issue or PR); confirm what was removed so it can be restored.
- **"resume #N" / "retry #N"** — re-apply the appropriate trigger label for where the item stalled (e.g. an issue stuck in `planning` whose agent died → swap back to `ready`; a PR stuck in `revising` → swap back to `needs revision`).

## Pacing

After each tick, schedule the next wakeup with ScheduleWakeup, prompt `/pipeline`:

- Any agent in flight or any item mid-pipeline → ~270 seconds.
- Fully idle (nothing in flight, nothing actionable) → ~1500 seconds.

Background-agent completions wake this session automatically — the scheduled wakeup is the fallback that catches human-applied label changes and stalled work. On every wakeup, run the tick procedure again.
