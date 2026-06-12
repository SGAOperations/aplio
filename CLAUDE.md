# Claude Instructions for Aplio

## Commit & Branch Naming Conventions

### Commits

- **Format**: `#XXX commit message in lowercase imperative mood`
- **Examples**:
  - `#6 configure dev tooling`
  - `#12 add application submission form`
  - `#34 fix committee member display`
- **Rules**:
  - Always prefix with issue number
  - Use lowercase only
  - Use imperative mood (add, fix, refactor, not added, fixed, refactored)
  - No colon after issue number
  - Always include `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` trailer
  - Commit frequently — each logical unit of work should be its own commit

### Branches

- **Format**: `XXX-ticket-name-in-kebab-case`
- **Examples**:
  - `6-configure-dev-tooling`
  - `12-add-application-submission-form`
  - `34-fix-committee-member-display`

### Pull Requests

- **Format**: `#XXX Ticket Name In Title Case`
- **Assignees**: Always assign `b-at-neu` (`--assignee "b-at-neu"`)
- **Issue Linking**: Use `Closes #XXX` in the PR body — GitHub will close the issue automatically on merge

### Issue Tracking

- Issues are tracked in **GitHub Issues** at `SGAOperations/aplio`
- Never use Linear for this project
- When starting work on a ticket, assign it first: `gh issue edit XXX --add-assignee "@me"`

#### Issue Labels

Labels are normally managed by the `/pipeline` cockpit — manual `gh` label commands are for recovery only. `PIPELINE.md` is the authoritative pipeline doc.

- `claude` — cockpit at opt-in (Claude is handling this ticket)
- `ready` — cockpit at opt-in; triggers the plan agent
- `planning` — plan agent (in-flight)
- `plan review` — plan agent; plan written, awaiting human approval in the cockpit
- `plan changes requested` — cockpit after human feedback; triggers plan revision
- `plan approved` — cockpit after human approval (or automatically with `auto plan`); triggers impl agent
- `auto plan` — cockpit at opt-in; skips the plan-review gate for this ticket
- `in progress` — impl agent (in-flight)
- `pr opened` — impl agent when the PR is opened; replaces `in progress`
- `blocked` — impl agent; needs a human decision (details in issue comment)

#### PR Labels

- `ready for review` — impl agent (first pass) or revise agent (after fixes); triggers review agent
- `reviewing` — review agent (in-flight)
- `needs revision` — review agent when Critical or Medium issues are found; triggers revise agent
- `revising` — revise agent (in-flight)
- `approved` — review agent when only Low/Nit issues remain; the human merges on GitHub
- `needs human` — cockpit escalation (3 review cycles without convergence, or rebase conflict); pipeline stops touching the PR

#### Sub-Issues

Sub-issues are linked via the REST API using the database `id` (not the issue number):

```bash
# Get the database ID of the child issue
gh api repos/SGAOperations/aplio/issues/<number> --jq '.id'

# Add it as a sub-issue of a parent
gh api repos/SGAOperations/aplio/issues/<parent-number>/sub_issues -X POST --input - <<'EOF'
{"sub_issue_id": <database-id>}
EOF
```

#### Blockers

Blocker relationships are added via GraphQL using node IDs:

```bash
# Get the node ID of an issue
gh api repos/SGAOperations/aplio/issues/<number> --jq '.node_id'

# Add a blocked-by relationship (issueId = blocked issue, blockingIssueId = the blocker)
gh api graphql -f query='mutation { addBlockedBy(input: { issueId: "BLOCKED_NODE_ID", blockingIssueId: "BLOCKER_NODE_ID" }) { clientMutationId } }'
```

## Tech Stack

- **Framework**: Next.js with App Router
- **Database**: Prisma ORM
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn/ui
- **Language**: TypeScript (strict mode)
- **Auth**: Stack Auth

## Architecture & Patterns

### API Layer

- **NEVER use API routes** (`app/api/` directory)
- **ALWAYS use Server Actions** for data mutations
- **Use server components** for data fetching with Prisma calls
- Import Prisma queries from separate service files in `prisma/services/`

> **Exception**: `app/api/auth/[...path]/route.ts` is required by Neon Auth — this is the only permitted API route.

### Component Structure

- Components live in the centralized `components/` directory
- Organize into subdirectories:

```
components/
  ├── ui/           # shadcn components
  ├── forms/        # form-related components
  ├── layouts/      # layout components
  └── features/     # feature-specific shared components
```

### TypeScript

- Use TypeScript strict mode
- Define proper types for all props and function parameters
- Avoid `any` type
- Prefer interfaces for complex component props
- Use Prisma-generated types where applicable

### Server Actions

- Define server actions in `prisma/services/` (e.g., `prisma/services/application-actions.ts`)
- Always use `'use server'` directive
- Include proper error handling and validation
- Return typed responses

### Data Access

- All database operations go through Prisma
- Create service files in `prisma/services/` for all queries and mutations
- Keep Prisma calls in server components or server actions only
- **Never expose database calls to client components**

### File Organization

```
app/
  ├── (routes)/           # route groups
components/               # shared components
lib/
  ├── actions/           # server actions
  ├── data/              # data queries and services
  ├── db.ts              # Prisma client
  └── utils.ts           # utility functions
prisma/
  ├── schema.prisma      # Prisma schema
  └── services/          # server actions and data access logic
```

## Code Style Preferences

- **Named exports only** — never use default exports
- Prefer functional components with hooks
- Use async/await over promises
- Implement proper loading and error states
- Use Tailwind classes, avoid custom CSS unless absolutely necessary
- Follow shadcn/ui patterns for component composition
- For single line loops or conditionals, do not use curly braces
- Only add comments when necessary to explain complex logic

## Best Practices

1. **Server vs Client Components**:
   - Default to server components
   - Only use `'use client'` when needed (interactivity, hooks, browser APIs)

2. **Data Fetching**:
   - Fetch data in server components
   - Use Prisma for all database queries
   - **Never use `useEffect` for data fetching or state synchronization**

3. **Forms**:
   - Use Server Actions for form submissions
   - Implement progressive enhancement
   - Add proper validation (client + server)

4. **Performance**:
   - Leverage Next.js caching strategies
   - Use `revalidatePath` or `revalidateTag` after mutations

5. **Security**:
   - Validate all inputs
   - Never expose sensitive data to client
   - Use environment variables for secrets

6. **Mobile Support**:
   - All UI components and pages must support mobile viewports
   - Use mobile-first Tailwind classes — start with base/mobile styles, add `md:` / `lg:` for larger screens
   - Sidebars must collapse on mobile — use a Sheet/drawer with a hamburger button on small screens, hidden on `md:` and above
   - Never use fixed pixel widths that break on small screens

## Claude-Specific Rules

### Pre-Push Checks

Before pushing any commits, always run all three CI check scripts and fix any failures before pushing:

```bash
npm run prettier:check   # fix with: npx prettier --write .
npm run eslint:check     # fix the underlying code — never add eslint-disable
npm run tsc:check        # fix type errors before pushing
```

Never push with known failures — CI will catch them and the PR will be blocked.

### ESLint

- **Never add `eslint-disable` comments** — fix the underlying code instead

### Prisma

- Always use `npx prisma`, not `node_modules/.bin/prisma`

### Merge Conflicts

- When resolving merge conflicts, preserve features from both sides unless one side is clearly superseded

### File Editing

- Prefer editing existing files over creating new ones

### Worktrees

- **Always use git worktrees** when working on a feature branch to avoid branch switching issues
- Use `isolation: "worktree"` when spawning agents so each agent works in an isolated copy of the repo
- After creating a worktree, symlink shared resources from the main repo instead of reinstalling:

```bash
ln -s ../../node_modules <worktree-path>/node_modules
ln -s ../../.env <worktree-path>/.env
```

### Syncing Before Resuming Work

Before resuming work on any existing branch or worktree, always sync to the latest remote state:

1. **Fetch and reset the branch** to match the remote:

```bash
git -C <worktree-path> fetch origin
git -C <worktree-path> reset --hard origin/<branch-name>
```

2. **Check if `main` has advanced** and rebase if needed:

```bash
git -C <worktree-path> fetch origin main
git -C <worktree-path> rebase origin/main
```

Never assume the local branch is up to date — always fetch first.

### Design Specs

- Specs are brainstormed and written collaboratively as a document
- The final spec content goes into the **GitHub Issue description** for the relevant ticket — using `gh issue edit` to update the body
- Spec files must **never be committed to git** — not to main, not to feature branches
- The brainstormed document is for thinking only; the GitHub Issue is the source of truth
