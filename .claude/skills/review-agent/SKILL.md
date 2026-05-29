---
name: review-agent
description: Pipeline Stage 3 — reviews a PR diff against the original plan and posts a structured review comment. Usage: /review-agent <pr-number>
---

# Review Agent — Stage 3

**Trigger:** PR labeled `ready for review`
**Input:** `$ARGUMENTS` — the PR number

## Pre-flight

Fetch the PR and verify it is labeled `ready for review`:

```bash
gh pr view $ARGUMENTS --repo SGAOperations/aplio --json labels,title,body
```

If the PR does not have the `ready for review` label, stop immediately and say:

> "PR #$ARGUMENTS is not labeled `ready for review`. Current labels: [list them]. Nothing was changed."

## Work

### 1. Fetch context

```bash
# Full PR diff
gh pr diff $ARGUMENTS --repo SGAOperations/aplio

# PR metadata — find the linked issue number in "Closes #XXX"
gh pr view $ARGUMENTS --repo SGAOperations/aplio --json body,title,headRefName

# Fetch the linked issue to get the original plan
gh issue view <issue-number> --repo SGAOperations/aplio
```

### 2. Review the diff

For each finding, note the file, line, severity, and whether it was **introduced in this PR** or is **preexisting code**.

Review across these dimensions:

- **Correctness** — does the implementation match every item in the plan checklist?
- **Security** — OWASP top 10, auth checks on all server actions, input validation, dev-only code behind env gates
- **Conventions** — named exports only, no API routes (except `/api/auth`), server actions in `prisma/services/`, Tailwind only, mobile-first classes, no `useEffect` for data fetching
- **Type safety** — no `any`, proper Prisma-generated types, TypeScript strict mode compliance
- **Performance** — unnecessary re-renders, missing `revalidatePath` after mutations, N+1 queries
- **Completeness** — every plan checklist item is addressed in the diff

### 3. Post structured review comment

```bash
gh pr comment $ARGUMENTS --repo SGAOperations/aplio --body "<review comment>"
```

Format:

```
## Code Review

### Critical
- `path/to/file.ts:42` — Description of the issue

### Medium
- `path/to/file.ts:88` — Description of the issue

### Low
- `path/to/file.ts:15` — Description of the issue

### Nit
- `path/to/file.ts:7` — Description of the issue

---
_Reviewed against plan in issue #XXX_
```

Omit any severity section that has no findings.

## Handoff

```bash
# Critical or Medium findings exist:
gh pr edit $ARGUMENTS --repo SGAOperations/aplio \
  --remove-label "ready for review" \
  --add-label "needs revision"

# Only Low/Nit findings (or none):
gh pr edit $ARGUMENTS --repo SGAOperations/aplio \
  --remove-label "ready for review" \
  --add-label "approved"
```
