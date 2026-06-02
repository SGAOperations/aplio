---
name: revise-all
description: Dispatches background revise-agents for all PRs labeled `needs revision`. Usage: /revise-all
---

# Revise All — Bulk Dispatcher

**Trigger:** Manual
**Input:** none

## Work

### 1. Fetch all PRs labeled `needs revision`

```bash
gh pr list --repo SGAOperations/aplio --label "needs revision" --json number,title
```

If no PRs are found, stop and say:

> "No PRs labeled `needs revision`. Nothing was dispatched."

### 2. Dispatch one background revise-agent per PR

Spawn all agents in a **single message** as parallel tool calls — one `Agent` call per PR, all with `run_in_background: true`.

Each agent's prompt should contain the full revise-agent ## Work instructions with the specific PR number substituted for `<pr-number>`.

### 3. Report

After dispatching, say:

> "Dispatched revise agents for PRs: #N, #N, #N. You'll be notified as each one completes."
