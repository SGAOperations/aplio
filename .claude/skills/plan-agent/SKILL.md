---
name: plan-agent
description: Pipeline Stage 1 — reads an issue labeled `ready`, researches the codebase, and writes a full implementation plan back into the issue. Usage: /plan-agent <issue-number>
---

# Plan Agent — Stage 1

**Trigger:** Issue labeled `ready`
**Input:** `$ARGUMENTS` — the issue number

## Pre-flight

Fetch the issue and verify it is labeled `ready`:

```bash
gh issue view $ARGUMENTS --repo SGAOperations/aplio --json labels,title
```

If the issue does not have the `ready` label, stop immediately and say:
> "Issue #$ARGUMENTS is not labeled `ready`. Current labels: [list them]. Nothing was changed."

## Work

### 1. Fetch full issue context

```bash
gh issue view $ARGUMENTS --repo SGAOperations/aplio
gh issue view $ARGUMENTS --repo SGAOperations/aplio --comments
```

### 2. Research the codebase

- Read all files referenced in the issue body
- Identify every file that will need to be created or modified
- Trace downstream consumers of affected components
- Check for open branches that might conflict:

```bash
gh pr list --repo SGAOperations/aplio --state open
```

### 3. Ask clarifying questions

As ambiguities are discovered during research, pause and ask the user before continuing. Do not write the plan until all blocking questions are resolved.

### 4. Write the implementation plan

Write the plan back into the issue body. The plan must include:

- **Architecture decisions** — which files to create/modify and why
- **Implementation checklist** — step-by-step tasks as GitHub checkboxes (`- [ ]`)
- **Edge cases and constraints**
- **Schema changes** — any Prisma schema modifications required
- **Test/validation plan**
- **Conflicts flagged** — any open branches or in-progress work that overlaps

```bash
gh issue edit $ARGUMENTS --repo SGAOperations/aplio --body "<full plan content>"
```

## Handoff

```bash
gh issue edit $ARGUMENTS --repo SGAOperations/aplio --remove-label "ready" --add-label "plan approved"
```
