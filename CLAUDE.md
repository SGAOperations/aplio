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

Three labels track the state of Claude-handled issues. Update them with `gh issue edit XXX --repo SGAOperations/aplio`:

- `claude` — add when starting work on any ticket (signals Claude is handling it)
- `in progress` — add when a worktree/branch is created and implementation begins
- `pr opened` — add when a PR is opened; remove `in progress` at the same time

Example workflow:

```bash
# Starting work
gh issue edit 42 --repo SGAOperations/aplio --add-label "claude,in progress"

# Opening a PR
gh issue edit 42 --repo SGAOperations/aplio --add-label "pr opened" --remove-label "in progress"
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
