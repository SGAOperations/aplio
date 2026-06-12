---
name: review-agent
description: Pipeline Stage 3 — reviews a PR diff against the original plan, CI status, and ENGINEERING.md, then posts a structured review comment. Dispatched by /pipeline (model: sonnet); manual usage: /review-agent <pr-or-issue-number>
allowed-tools: Bash(gh issue view *) Bash(gh pr list *) Bash(gh pr view *) Bash(gh pr diff *) Bash(gh pr checks *) Bash(gh pr comment *) Bash(gh pr edit *)
---

# Review Agent — Stage 3

**Trigger:** PR labeled `ready for review`
**Input:** `$ARGUMENTS` — a PR number or issue number
**Model:** sonnet

## Pre-flight

### Resolve input to a PR number

Try to fetch the input as a PR directly:

```bash
gh pr view $ARGUMENTS --repo SGAOperations/aplio --json labels,title,body
```

If that succeeds, `$ARGUMENTS` is the PR number — proceed.

If it fails (the input is an issue number), find the linked PR:

```bash
gh pr list --repo SGAOperations/aplio --search "closes #$ARGUMENTS" --json number,title
```

If a PR is found, use its number as the PR number for all steps below. If no PR is found, stop and say:

> "No open PR found linked to issue #$ARGUMENTS. Nothing was changed."

### Verify label

Confirm the PR is labeled `ready for review`. If not, stop immediately and say:

> "PR #<pr-number> is not labeled `ready for review`. Current labels: [list them]. Nothing was changed."

## Label swap (always first action after pre-flight)

```bash
gh pr edit <pr-number> --repo SGAOperations/aplio \
  --remove-label "ready for review" \
  --add-label "reviewing"
```

## Work

### 1. Fetch context

```bash
# Full PR diff
gh pr diff <pr-number> --repo SGAOperations/aplio

# CI status — failing required checks are Critical findings
gh pr checks <pr-number> --repo SGAOperations/aplio

# PR metadata — find the linked issue number in "Closes #XXX"
gh pr view <pr-number> --repo SGAOperations/aplio --json body,title,headRefName

# Fetch the linked issue to get the original plan
gh issue view <issue-number> --repo SGAOperations/aplio
```

Also read `ENGINEERING.md` at the repo root — it is a review dimension.

### 2. Review the diff

For each finding, note the file, line, severity, and whether it was **introduced in this PR** or is **preexisting code**.

Review across these dimensions:

- **CI** — any failing required check is a Critical finding citing the check name
- **Correctness** — does the implementation match every item in the plan checklist?
- **Security** — OWASP top 10, auth checks + zod validation on all server actions, authorization scoping (no IDOR), input validation, dev-only code behind env gates
- **Engineering standards** — violations of `ENGINEERING.md` (cite the section, e.g. "ENGINEERING.md §4: missing empty state")
- **Conventions** — named exports only, no API routes (except `/api/auth`), server actions in `prisma/services/`, Tailwind only, mobile-first classes, no `useEffect` for data fetching
- **Type safety** — no `any`, proper Prisma-generated types, TypeScript strict mode compliance
- **Performance** — unnecessary re-renders, missing `revalidatePath` after mutations, N+1 queries
- **Completeness** — every plan checklist item is addressed; loading/error/empty states shipped for every async surface

### 3. Post structured review comment

```bash
gh pr comment <pr-number> --repo SGAOperations/aplio --body "<review comment>"
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
gh pr edit <pr-number> --repo SGAOperations/aplio \
  --remove-label "reviewing" \
  --add-label "needs revision"

# Only Low/Nit findings (or none):
gh pr edit <pr-number> --repo SGAOperations/aplio \
  --remove-label "reviewing" \
  --add-label "approved"
```
