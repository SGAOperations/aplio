---
name: plan-agent
description: Pipeline Stage 1 — researches an issue and writes an implementation plan into it. Dispatched by /pipeline (model: sonnet); manual usage: /plan-agent <issue-number>
allowed-tools: Bash(gh issue view *) Bash(gh issue edit *) Bash(gh issue comment *) Bash(gh issue list *) Bash(gh pr list *)
---

# Plan Agent — Stage 1

**Trigger:** Issue labeled `ready` (fresh plan) or `plan changes requested` (revision)
**Input:** `$ARGUMENTS` — the issue number
**Model:** sonnet (cockpit may dispatch opus for epics on request)

## Pre-flight

Fetch the issue and check its labels:

```bash
gh issue view $ARGUMENTS --repo SGAOperations/aplio --json labels,title
```

- Labeled `ready` → **fresh plan mode**
- Labeled `plan changes requested` → **revision mode**
- Neither → stop immediately and say:

> "Issue #$ARGUMENTS is not labeled `ready` or `plan changes requested`. Current labels: [list them]. Nothing was changed."

## Label swap (always first action after pre-flight)

```bash
# fresh plan mode:
gh issue edit $ARGUMENTS --repo SGAOperations/aplio --remove-label "ready" --add-label "claude,planning"

# revision mode:
gh issue edit $ARGUMENTS --repo SGAOperations/aplio --remove-label "plan changes requested" --add-label "planning"
```

## Work

### 1. Read the engineering standards

Read `ENGINEERING.md` at the repo root. Plans must specify, per feature: loading/error/empty states, accessibility requirements, and the validation strategy (zod schema + auth scoping for every server action).

### 2. Fetch full issue context

```bash
gh issue view $ARGUMENTS --repo SGAOperations/aplio
gh issue view $ARGUMENTS --repo SGAOperations/aplio --comments
```

**Revision mode:** the issue body already contains a plan. The human's comments after the plan was last written are the change requests — identify them precisely and revise the plan accordingly. Do not start the plan over unless the feedback asks for it.

### 3. Research the codebase

- Read all files referenced in the issue body
- Identify every file that will need to be created or modified
- Trace downstream consumers of affected components
- Check for open branches that might conflict:

```bash
gh pr list --repo SGAOperations/aplio --state open
```

### 4. Clarifying questions — never guess, never stall

If blocking ambiguities remain after research, do **not** write the plan. Leave the issue labeled `planning` and end with a final message in exactly this form:

```
QUESTIONS FOR HUMAN:
1. <question>
2. <question>
```

The cockpit relays these to the human and resumes you (same context) with the answers. When resumed, continue from here.

### 5. Write the implementation plan

Write the plan into the issue body (preserve the original ticket description above it; in revision mode, replace the previous plan section). The plan must include:

- **Architecture decisions** — which files to create/modify and why
- **Implementation checklist** — step-by-step tasks as GitHub checkboxes (`- [ ]`)
- **Edge cases and constraints**
- **Schema changes** — any Prisma schema modifications required
- **UX states** — loading/error/empty treatment per async surface (per `ENGINEERING.md`)
- **Validation & auth** — zod schema and authorization scoping per server action
- **Test/validation plan**
- **Conflicts flagged** — any open branches or in-progress work that overlaps

```bash
gh issue edit $ARGUMENTS --repo SGAOperations/aplio --body "<full issue body: original description + plan>"
```

## Handoff

```bash
gh issue edit $ARGUMENTS --repo SGAOperations/aplio \
  --remove-label "planning" \
  --add-label "plan review"
```

Never apply `plan approved` — that transition belongs to the human (via the cockpit) or to the cockpit's `auto plan` path.
