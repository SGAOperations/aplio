---
name: review-all
description: Dispatches background review-agents for all PRs labeled `ready for review`. Usage: /review-all
allowed-tools: Bash(gh pr list *)
---

# Review All — Bulk Dispatcher

**Trigger:** Manual
**Input:** none

## Work

### 1. Fetch all PRs labeled `ready for review`

```bash
gh pr list --repo SGAOperations/aplio --label "ready for review" --json number,title
```

If no PRs are found, stop and say:

> "No PRs labeled `ready for review`. Nothing was dispatched."

### 2. Dispatch one background review-agent per PR

Spawn all agents in a **single message** as parallel tool calls — one `Agent` call per PR, all with `run_in_background: true`.

Each agent's prompt should contain the full review-agent ## Work instructions with the specific PR number substituted for `<pr-number>`.

### 3. Report

After dispatching, say:

> "Dispatched review agents for PRs: #N, #N, #N. You'll be notified as each one completes."
