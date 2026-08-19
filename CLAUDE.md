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
- **Mutations are Server Actions** in `prisma/actions/`, each with `'use server'`, an auth check, and zod validation. They return **`void` / the relevant data on success, `{ error }` for a user-facing failure, and `throw` for unexpected ones — never `{ ok }`** (`.claude/docs/ENGINEERING.md` §4). Decision test: _would you show this exact sentence to the user, and can they act on it?_ **yes → `{ error }`, no → throw**.
- **Data fetching is server-side** — server components call data-fetching functions in `prisma/data/`; Prisma never runs in a client component. **Avoid `useEffect`** — almost every use is a mistake here, and an empty-deps `useEffect` is essentially never right.
- **Default to server components**; add `'use client'` only for interactivity/hooks/browser APIs, on the smallest leaf possible.
- **Every async surface ships loading + empty states**; errors use **one global boundary + toasts** (never per-page `error.tsx`); **every action gives a toast** (`sonner`) — see `.claude/docs/ENGINEERING.md` §4.
- Components live in `components/` (`ui/` shadcn, `forms/`, `layouts/`, `features/`); route-specific components co-locate with their route.
- **Shared types/constants live in `lib/` (`lib/types.ts`, `lib/constants.ts`) — reuse them** (a little over-fetch to reuse a type is fine; never expose sensitive/internal fields to a client). Abstract repetition sensibly; avoid over-abstraction.

## Code Style

- **Named exports only** — never default exports.
- Strict TypeScript, **no `any`** (`unknown` + narrowing); prefer Prisma-generated types.
- Tailwind only — avoid custom CSS. **Mobile-first**: base styles target mobile, add `md:`/`lg:` upward; sidebars collapse to a Sheet/drawer on small screens; no fixed pixel widths that break narrow viewports.
- `async`/`await` over promise chains. Single-line loops/conditionals: no curly braces.
- **Comments are rare, one line by default, two only rarely** — default to none and let naming carry it. Terse fragments, not narrated sentences; no issue/PR/`ENGINEERING §` refs (`git blame` already links the line to its PR). JSDoc only where the signature doesn't already say it. Full rule: `.claude/docs/ENGINEERING.md` §7.
- `revalidatePath`/`revalidateTag` after every mutation; **toast feedback (`sonner`) on every action**.

## Commits, Branches, PRs

- **Commit:** subject `#XXX message in lowercase imperative mood` (no colon after the number, **under 80 chars**, no trailing period); then — only if the _why_ isn't obvious — a blank line and a short body (wrap ~72, a few lines max; narrative belongs in the PR, not the commit); then a blank line and a `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` trailer. Commit each logical unit separately. **Write the message to a file and `git commit -F .temp/commit-msg.txt`** — inline multi-line `-m … -m …` collapses on Windows, dropping the subject and the co-authorship. Delete tracked files with `git rm`. **The subject-line format is enforced locally by a `commit-msg` hook** (installed automatically via `npm run prepare` / `npm ci`) **and in CI by `run-commit-message-check`**, which validates every commit in a PR by invoking that same hook — so the two cannot drift.
- **Branch:** `XXX-ticket-name-in-kebab-case`, branched off `dev`.
- **PR:** title `#XXX Ticket Name In Title Case`; **base branch `dev`** (never open feature PRs against `main`); body contains `Closes #XXX`; assign the **issue's assignee** (fallback: yourself — `@me`); **pipeline-authored PRs also carry the `claude` label** — it is what activates the `approved` merge gate (`approval-check.yml`), and without it the PR merges ungated. `dev → main` is promoted only by `/release`.
- **Rebase conflicts in pipeline:** `revise-agent` attempts autonomous resolution for structurally unambiguous conflicts (non-overlapping sections, generated files, dual independent imports). It escalates to `needs human` only when both sides modified the same logical unit. Agents should document every resolution in the revision summary. Full protocol: `.claude/docs/PIPELINE.md` → "Rebase conflict protocol".

## Preview databases (Neon branch budget)

The Neon project caps at **10 branches** and 2 are permanently held (`dev`, `production`), so **~8 PRs can hold a preview database at once**. Every open PR with a preview deployment consumes one slot. Reclamation is automatic (branch auto-delete on merge plus Neon's own sweep), so this is a **concurrency ceiling, not a housekeeping chore** — what exhausts it is too many PRs open at the same time. Exhaustion shows up as a red `Vercel` check on _every_ open PR while `run-prettier-check` / `run-linting-check` / `run-tsc-check` stay green: check the Neon branch count before debugging Prisma. Full operational detail: `.claude/docs/PIPELINE.md` → "Preview-database concurrency".

## Pre-push checks (always, before pushing)

```bash
npm run prettier:check   # fix: npm run prettier:fix
npm run eslint:check     # fix the underlying code — NEVER add eslint-disable
npm run tsc:check        # fix type errors
npm run test             # unit + db projects; fall back to test:unit if Postgres is unavailable
```

Never push with known failures. Run Prisma via the **`npm run prisma:*` scripts** — `npm run prisma:generate`, `npm run prisma:migrate -- --name <name>` — **never `npx prisma`** (npx is allow-listed for shadcn only; pipeline agents auto-deny other `npx`). Same for prettier/tsc/tsx: use `npm run …`, not `npx …`.

All tests live under `tests/`, never co-located with the source they cover: `tests/unit/**/*.test.ts` (`unit` project, pure functions, no DB) and `tests/db/**/*.test.ts` (`db` project, real Postgres via `tests/stubs/`-aliased guards) — see `vitest.config.ts` and the README's "Running tests" section.

## Issue Tracking

- Issues live in **GitHub Issues** at `SGAOperations/aplio` — **never Linear**. Assign before starting: `gh issue edit XXX --add-assignee "@me"`.
- The pipeline's label state machine and the sub-issue / blocker linking recipes are documented in **`.claude/docs/PIPELINE.md`** and the `scope` skill — labels are normally managed by the `/pipeline` cockpit; manual `gh` label commands are recovery-only.

## Worktrees & local dev

- Pipeline agents get their own isolated worktree automatically (`isolation: worktree`) — they handle setup; see `.claude/docs/PIPELINE.md`. Do not script worktree creation for them.
- For manual local work in a worktree, install deps with `npm ci` (then `npm run prisma:generate`). **Do not `ln -s node_modules` — symlinks fall back to copies on Windows here.** Sync before resuming: `git fetch origin && git rebase origin/dev`.
- **`npm ci` is what activates Git hooks** — it runs `prepare` (`husky && npm run hooks:check`), which regenerates the untracked `.husky/_` bootstrap dir, sets `core.hooksPath`, and fails `npm ci` itself if activation didn't take. Each worktree/clone needs its own `npm ci` for hooks to fire there. If hooks stop firing, re-run `npm ci` (or `npm run prepare`) and verify with `npm run hooks:check`.
- **The same step sets `core.commentChar=';'`** — git's default `#` makes it strip the mandated `#XXX` subject as a comment every time it re-reads a message through the editor machinery (`git rebase --continue`, `git commit --amend`), silently promoting the first body line into the subject; the `commit-msg` hook does not run on that path. Side effect: git's own instructional lines in the commit editor are `;`-prefixed. This writes to the shared `.git/config`, so one worktree's `npm ci` fixes every worktree of that clone. It cannot be enforced across fresh clones or forks, which is why CI validates subjects too.

## Design Specs

Specs are brainstormed collaboratively, then the final content goes into the **GitHub Issue description** (`gh issue edit`). The Issue is the source of truth — **spec files are never committed to git**.
