---
name: impl-agent
description: Pipeline Stage 2 — reads the approved plan from an issue and implements it. Usage: /impl-agent <issue-number>
---

# Impl Agent — Stage 2

**Trigger:** Issue labeled `plan approved`
**Input:** `$ARGUMENTS` — the issue number

Spawn a background sub-agent with the instructions below, then return immediately.

```
Agent({
  description: "impl-agent for issue #$ARGUMENTS",
  run_in_background: true,
  prompt: "<paste the ## Work section below as the prompt>"
})
```

## Pre-flight

Fetch the issue and verify it is labeled `plan approved`:

```bash
gh issue view $ARGUMENTS --repo SGAOperations/aplio --json labels,title
```

If the issue does not have the `plan approved` label, stop immediately and say:

> "Issue #$ARGUMENTS is not labeled `plan approved`. Current labels: [list them]. Nothing was changed."

## Work

### 1. Read the plan

```bash
gh issue view $ARGUMENTS --repo SGAOperations/aplio
```

Read the full issue body — this contains the implementation plan with the checklist to follow.

### 2. Label issue as in progress

```bash
gh issue edit $ARGUMENTS --repo SGAOperations/aplio --remove-label "plan approved" --add-label "in progress"
```

### 3. Create worktree and branch

Branch naming: `XXX-ticket-name-in-kebab-case` where XXX is the issue number.

```bash
git fetch origin
git worktree add ../<branch-name> -b <branch-name> origin/main
ln -s ../../node_modules ../<branch-name>/node_modules
ln -s ../../.env ../<branch-name>/.env
```

### 4. Implement the checklist

Work through each item in the plan's implementation checklist. Follow all project conventions:

- Named exports only — never default exports
- Server Actions for all mutations, defined in `prisma/services/`
- No API routes except `/api/auth`
- Tailwind only — no custom CSS
- Mobile-first responsive design
- TypeScript strict mode — no `any`
- Never use `useEffect` for data fetching — use server components

Commit each logical unit:

```bash
git commit -m "$(cat <<EOF
#$ARGUMENTS <imperative message in lowercase>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

If something unanticipated arises that the plan did not cover, do **not** pause — instead:

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
3. Exit without pushing any partial work.

### 5. Run CI checks

```bash
npm run prettier:check   # fix with: npx prettier --write .
npm run eslint:check     # fix underlying code — never add eslint-disable
npm run tsc:check        # fix type errors
```

Fix all failures before proceeding.

### 6. Open PR

```bash
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
