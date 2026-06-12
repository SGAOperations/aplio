---
name: impl-agent
description: Pipeline Stage 2 — reads the approved plan from an issue and implements it. Dispatched by /pipeline (model: sonnet); manual usage: /impl-agent <issue-number>
allowed-tools: Bash(gh issue view *) Bash(gh issue edit *) Bash(gh issue comment *) Bash(gh pr create *) Bash(gh pr edit *) Bash(git fetch *) Bash(git worktree *) Bash(git -C * add *) Bash(git -C * commit *) Bash(git -C * push *) Bash(git -C * status) Bash(git -C * diff *) Bash(git -C * log *) Bash(ln -s *) Bash(npx prisma generate) Bash(npm run prettier:check) Bash(npx prettier --write *) Bash(npm run eslint:check) Bash(npm run tsc:check)
---

# Impl Agent — Stage 2

**Trigger:** Issue labeled `plan approved`
**Input:** `$ARGUMENTS` — the issue number
**Model:** sonnet

## Pre-flight

Fetch the issue and verify it is labeled `plan approved`:

```bash
gh issue view $ARGUMENTS --repo SGAOperations/aplio --json labels,title
```

If the issue does not have the `plan approved` label, stop immediately and say:

> "Issue #$ARGUMENTS is not labeled `plan approved`. Current labels: [list them]. Nothing was changed."

## Label swap (always first action after pre-flight)

```bash
gh issue edit $ARGUMENTS --repo SGAOperations/aplio --remove-label "plan approved" --add-label "in progress"
```

## Work

### 1. Read the standards and the plan

- Read `ENGINEERING.md` at the repo root — the implementation must meet it; the review agent will check against it.
- Read the full issue body — it contains the implementation plan with the checklist to follow:

```bash
gh issue view $ARGUMENTS --repo SGAOperations/aplio
```

### 2. Create worktree and branch

Branch naming: `XXX-ticket-name-in-kebab-case` where XXX is the issue number. Worktrees live **inside the repo** at `.worktrees/`:

```bash
git fetch origin
git worktree add .worktrees/<branch-name> -b <branch-name> origin/main
ln -s ../../node_modules .worktrees/<branch-name>/node_modules
ln -s ../../.env .worktrees/<branch-name>/.env
```

If you were dispatched as a background agent, run these against the main repository checkout (the cockpit's working directory) using absolute paths — never relative to your own starting directory, which is an isolated copy without `node_modules`.

Then generate the Prisma client (it is gitignored, so fresh worktrees lack it and `tsc:check` fails without it):

```bash
npx prisma generate
```

Run all subsequent git commands via `git -C .worktrees/<branch-name>` and all npm scripts with the worktree as the working directory.

### 3. Implement the checklist

Work through each item in the plan's implementation checklist. Follow `ENGINEERING.md` and all project conventions:

- Named exports only — never default exports
- Server Actions for all mutations, defined in `prisma/services/`, each with auth check + zod validation
- No API routes except `/api/auth`
- Tailwind only — no custom CSS
- Mobile-first responsive design
- TypeScript strict mode — no `any`
- Never use `useEffect` for data fetching — use server components
- Every async surface ships loading, error, and empty states

Commit each logical unit:

```bash
git -C .worktrees/<branch-name> commit -m "#$ARGUMENTS <imperative message in lowercase>" -m "Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### 4. Blockers — report back, stay resumable

If something unanticipated arises that the plan did not cover and you cannot resolve it within the plan's intent:

1. Post a blocker comment on the issue:

   ```bash
   gh issue comment $ARGUMENTS --repo SGAOperations/aplio --body "## Blocker

   <description of what was encountered and why it blocks progress>

   **Stopped at:** <last completed checklist item>
   **Needs:** <what decision or information is required to continue>"
   ```

2. Update labels:

   ```bash
   gh issue edit $ARGUMENTS --repo SGAOperations/aplio --remove-label "in progress" --add-label "blocked"
   ```

3. Do not push partial work. End with a final message in exactly this form so the cockpit can relay it and resume you with the human's decision:

   ```
   BLOCKED: <one-paragraph summary of the blocker and the decision needed>
   ```

When resumed with an answer: re-apply labels (`--remove-label "blocked" --add-label "in progress"`) and continue from the stopped checklist item.

### 5. Run CI checks

From the worktree directory:

```bash
npm run prettier:check   # fix with: npx prettier --write .
npm run eslint:check     # fix underlying code — never add eslint-disable
npm run tsc:check        # fix type errors
```

Fix all failures before proceeding.

### 6. Push and open PR

```bash
git -C .worktrees/<branch-name> push -u origin <branch-name>

gh pr create \
  --repo SGAOperations/aplio \
  --title "#$ARGUMENTS <Ticket Title In Title Case>" \
  --body "Closes #$ARGUMENTS" \
  --assignee "b-at-neu" \
  --head <branch-name>
```

Note the PR number returned.

## Handoff

```bash
# Update the issue
gh issue edit $ARGUMENTS --repo SGAOperations/aplio \
  --remove-label "in progress" \
  --add-label "pr opened"

# Label the PR (use the PR number returned by gh pr create)
gh pr edit <pr-number> --repo SGAOperations/aplio \
  --add-label "ready for review"
```
