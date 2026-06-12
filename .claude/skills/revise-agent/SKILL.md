---
name: revise-agent
description: Pipeline Stage 4 — reads the review comment on a PR labeled `needs revision` and implements fixes. Dispatched by /pipeline (model: sonnet); manual usage: /revise-agent <pr-or-issue-number>
allowed-tools: Bash(gh issue view *) Bash(gh pr list *) Bash(gh pr view *) Bash(gh pr comment *) Bash(gh pr edit *) Bash(git fetch *) Bash(git worktree *) Bash(git -C * fetch *) Bash(git -C * reset *) Bash(git -C * rebase *) Bash(git -C * add *) Bash(git -C * commit *) Bash(git -C * push *) Bash(git -C * status) Bash(git -C * diff *) Bash(git -C * log *) Bash(ln -s *) Bash(npm run prettier:check) Bash(npx prettier --write *) Bash(npm run eslint:check) Bash(npm run tsc:check)
---

# Revise Agent — Stage 4

**Trigger:** PR labeled `needs revision`
**Input:** `$ARGUMENTS` — a PR number or issue number
**Model:** sonnet

## Pre-flight

### Resolve input to a PR number

Try to fetch the input as a PR directly:

```bash
gh pr view $ARGUMENTS --repo SGAOperations/aplio --json labels,title,headRefName
```

If that succeeds, `$ARGUMENTS` is the PR number — proceed.

If it fails (the input is an issue number), find the linked PR:

```bash
gh pr list --repo SGAOperations/aplio --search "closes #$ARGUMENTS" --json number,title,headRefName
```

If a PR is found, use its number as the PR number for all steps below. If no PR is found, stop and say:

> "No open PR found linked to issue #$ARGUMENTS. Nothing was changed."

### Verify label

Confirm the PR is labeled `needs revision`. If not, stop immediately and say:

> "PR #<pr-number> is not labeled `needs revision`. Current labels: [list them]. Nothing was changed."

## Label swap (always first action after pre-flight)

```bash
gh pr edit <pr-number> --repo SGAOperations/aplio \
  --remove-label "needs revision" \
  --add-label "revising"
```

## Work

### 1. Fetch the review comment

```bash
gh pr view <pr-number> --repo SGAOperations/aplio --comments
```

Find the most recent `## Code Review` comment. That is the review to address. Also read `ENGINEERING.md` at the repo root — apply it when fixing.

### 2. Derive the issue number and resume the worktree

If input was already an issue number, use it directly. Otherwise parse from the PR body (`Closes #XXX`):

```bash
gh pr view <pr-number> --repo SGAOperations/aplio --json body --jq '.body'
```

The branch is `<headRefName>`; its worktree lives at `.worktrees/<headRefName>`. If the worktree exists, sync it to the latest remote state (never assume it is up to date):

```bash
git -C .worktrees/<headRefName> fetch origin
git -C .worktrees/<headRefName> reset --hard origin/<headRefName>
git -C .worktrees/<headRefName> rebase origin/main
```

If the worktree does not exist, create it from the remote branch first:

```bash
git fetch origin
git worktree add .worktrees/<headRefName> <headRefName>
ln -s ../../node_modules .worktrees/<headRefName>/node_modules
ln -s ../../.env .worktrees/<headRefName>/.env
git -C .worktrees/<headRefName> rebase origin/main
```

If the rebase conflicts: abort it (`git -C .worktrees/<headRefName> rebase --abort`), post a comment on the PR describing the conflict, label the PR `needs human`, and end with a final message in exactly this form:

```
BLOCKED: rebase of <headRefName> onto origin/main conflicts in <files>; human decision needed.
```

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

From the worktree directory:

```bash
npm run prettier:check   # fix with: npx prettier --write .
npm run eslint:check     # fix underlying code — never add eslint-disable
npm run tsc:check        # fix type errors
```

Fix all failures before pushing.

### 5. Commit and push

```bash
git -C .worktrees/<headRefName> add <changed files>
git -C .worktrees/<headRefName> commit -m "#<issue-number> address review feedback" -m "Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git -C .worktrees/<headRefName> push origin <headRefName>
```

(Use `push --force-with-lease` only if the rebase rewrote already-pushed commits.)

### 6. Post summary comment

```bash
gh pr comment <pr-number> --repo SGAOperations/aplio --body "<summary>"
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
gh pr edit <pr-number> --repo SGAOperations/aplio \
  --remove-label "revising" \
  --add-label "ready for review"
```
