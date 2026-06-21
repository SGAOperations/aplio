# Claude Instructions for Aplio

These are the always-true rules for this repo. Depth lives in dedicated docs — read the relevant one before working:

- **`.claude/docs/ENGINEERING.md`** — the quality bar (architecture, data integrity, security, UX states, a11y, performance). Read it before any planning or code work.
- **`.claude/docs/PIPELINE.md`** — the automated agent pipeline and its GitHub label state machine.
- **`.claude/docs/DESIGN.md`** — the design system: tokens, type/spacing scale, component conventions. Read it before building or changing UI.
- **`.claude/docs/nextjs-notes.md`** — current Next.js 16 App Router behavior (caching, RSC boundaries, server actions). Trust it over training data.

## Tech Stack

Next.js 16 (App Router, React 19) · Prisma 7 · Tailwind CSS 4 · shadcn/ui (Radix) · TypeScript strict · zod 4 · react-hook-form · Neon/Stack Auth (`lib/auth/server.ts`).

## Architecture (the load-bearing rules — `.claude/docs/ENGINEERING.md` has the full bar)

- **IMPORTANT: never create API routes** (`app/api/`). The only permitted route is `app/api/auth/[...path]/route.ts` (required by Neon Auth).
- **Mutations are Server Actions** in `prisma/services/`, each with `'use server'`, an auth check, and zod validation, returning a typed `{ ok, error }` result.
- **Data fetching is server-side** — server components call service functions in `prisma/services/`. **NEVER fetch data or sync state with `useEffect`.** Prisma never runs in a client component.
- **Default to server components**; add `'use client'` only for interactivity/hooks/browser APIs, on the smallest leaf possible.
- **Every async surface ships loading, error, and empty states** (see `.claude/docs/ENGINEERING.md` §4).
- Components live in `components/` (`ui/` shadcn, `forms/`, `layouts/`, `features/`); route-specific components co-locate with their route.

## Code Style

- **Named exports only** — never default exports.
- Strict TypeScript, **no `any`** (`unknown` + narrowing); prefer Prisma-generated types.
- Tailwind only — avoid custom CSS. **Mobile-first**: base styles target mobile, add `md:`/`lg:` upward; sidebars collapse to a Sheet/drawer on small screens; no fixed pixel widths that break narrow viewports.
- `async`/`await` over promise chains. Single-line loops/conditionals: no curly braces.
- Comments explain non-obvious constraints, never narrate the next line.
- `revalidatePath`/`revalidateTag` after every mutation.

## Commits, Branches, PRs

- **Commit:** `#XXX message in lowercase imperative mood` (no colon after the number), with a `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` trailer. Commit each logical unit separately.
- **Branch:** `XXX-ticket-name-in-kebab-case`.
- **PR:** title `#XXX Ticket Name In Title Case`; body contains `Closes #XXX`; assign `b-at-neu`.

## Pre-push checks (always, before pushing)

```bash
npm run prettier:check   # fix: npm run prettier:fix
npm run eslint:check     # fix the underlying code — NEVER add eslint-disable
npm run tsc:check        # fix type errors
```

Never push with known failures. Use `npx prisma` (never `node_modules/.bin/prisma`).

## Issue Tracking

- Issues live in **GitHub Issues** at `SGAOperations/aplio` — **never Linear**. Assign before starting: `gh issue edit XXX --add-assignee "@me"`.
- The pipeline's label state machine and the sub-issue / blocker linking recipes are documented in **`.claude/docs/PIPELINE.md`** and the `scope` skill — labels are normally managed by the `/pipeline` cockpit; manual `gh` label commands are recovery-only.

## Worktrees & local dev

- Pipeline agents get their own isolated worktree automatically (`isolation: worktree`) — they handle setup; see `.claude/docs/PIPELINE.md`. Do not script worktree creation for them.
- For manual local work in a worktree, install deps with `npm ci` (then `npx prisma generate`). **Do not `ln -s node_modules` — symlinks fall back to copies on Windows here.** Sync before resuming: `git fetch origin && git rebase origin/main`.

## Design Specs

Specs are brainstormed collaboratively, then the final content goes into the **GitHub Issue description** (`gh issue edit`). The Issue is the source of truth — **spec files are never committed to git**.
