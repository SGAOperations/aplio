---
name: revise-agent
description: Pipeline Stage 4 — reads the review comment on a PR labeled `needs revision` and implements fixes. Usage: /revise-agent <pr-number>
---

# Revise Agent — Stage 4

**Trigger:** PR labeled `needs revision`
**Input:** `$ARGUMENTS` — the PR number

## Pre-flight

Fetch the PR and verify it is labeled `needs revision`:

```bash
gh pr view $ARGUMENTS --repo SGAOperations/aplio --json labels,title,headRefName
```

If the PR does not have the `needs revision` label, stop immediately and say:

> "PR #$ARGUMENTS is not labeled `needs revision`. Current labels: [list them]. Nothing was changed."

## Work

### 1. Fetch the review comment

```bash
gh pr view $ARGUMENTS --repo SGAOperations/aplio --comments
```

Find the most recent `## Code Review` comment. That is the review to address.

### 2. Derive the issue number and check out the branch

Parse the issue number from the PR body — it appears as `Closes #XXX`:

```bash
gh pr view $ARGUMENTS --repo SGAOperations/aplio --json body --jq '.body'
```

Extract the number after `Closes #` — this is `<issue-number>`, used in the commit message below.

Check out the branch:

```bash
git fetch origin
git checkout -b <headRefName> origin/<headRefName>
```

If the branch is already checked out locally, omit `-b origin/<headRefName>`. If a worktree already exists for this branch, work from there instead.

### 3. Apply fixes

For each finding in the review comment, use this decision table:

| Severity | Introduced in this PR                                        | Preexisting code                                     |
| -------- | ------------------------------------------------------------ | ---------------------------------------------------- |
| Critical | Fix always                                                   | Note in summary comment as a suggested future ticket |
| Medium   | Fix always                                                   | Note in summary comment as a suggested future ticket |
| Low      | Fix unless genuinely not an issue — if skipping, explain why | Note in summary comment as a suggested future ticket |
| Nit      | Fix unless genuinely not an issue — if skipping, explain why | Note in summary comment as a suggested future ticket |

Do not address anything outside the review comment — no scope creep.

### 4. Run CI checks

```bash
npm run prettier:check   # fix with: npx prettier --write .
npm run eslint:check     # fix underlying code — never add eslint-disable
npm run tsc:check        # fix type errors
```

Fix all failures before pushing.

### 5. Commit and push

```bash
git add <changed files>
git commit -m "$(cat <<EOF
#<issue-number> address review feedback

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
git push origin <headRefName>
```

### 6. Post summary comment

```bash
gh pr comment $ARGUMENTS --repo SGAOperations/aplio --body "<summary>"
```

Format:

```
## Revision Summary

### Fixed
- `path/to/file.ts:42` — What was changed and why

### Skipped (not an issue)
- `path/to/file.ts:15` — Explanation of why this is not actually a problem

### Preexisting issues — suggested for future tickets
- Description of the preexisting issue and suggested ticket scope
```

Omit any section with no entries.

## Handoff

```bash
gh pr edit $ARGUMENTS --repo SGAOperations/aplio \
  --remove-label "needs revision" \
  --add-label "ready for review"
```
