---
name: build-route-states
description: Add loading, error, and empty handling to a Next.js App Router route — loading.tsx/Suspense skeletons, a designed empty state, and error handling via the GLOBAL boundary + toasts (no per-page error.tsx), per .claude/docs/ENGINEERING.md §4.
allowed-tools: Read, Grep, Glob, Edit, Write
---

# Build route states (loading / error / empty)

Every async surface ships **all three** states (`.claude/docs/ENGINEERING.md` §4 and `.claude/docs/DESIGN.md` §5). A feature without them is incomplete, not minimal.

## Steps

1. **Identify the route segment** (`app/.../`) and which subtrees fetch data. Read `.claude/docs/DESIGN.md` for tokens (skeleton/empty must use semantic tokens, both themes).

2. **Loading** — for whole-page fetches add `loading.tsx`; for independent slow sections wrap them in `<Suspense>` with a skeleton that matches the final layout (no layout shift on resolve):

   ```tsx
   <Suspense fallback={<ApplicationListSkeleton />}>
     <ApplicationList cycleId={cycle.id} />
   </Suspense>
   ```

3. **Error — do NOT add a per-page `error.tsx`.** Errors are handled centrally (`.claude/docs/ENGINEERING.md` §4):
   - **Unexpected render/data-fetch errors** → the **global** boundary (`app/global-error.tsx` + a single route-group `error.tsx`). Create those only if missing — never one per route.
   - **Expected errors** (server-action failures) → surfaced as **toasts** (`sonner`): an action returns `{ error: 'message' }` (user-facing → specific toast) or **throws** (unexpected → generic toast). Never `{ ok }`, never a silent failure.

4. **Empty** — zero-item lists render a designed empty state (icon + one-line explanation + primary action), not a blank container:

   ```tsx
   if (items.length === 0)
     return (
       <EmptyState
         title="No applications yet"
         description="Applications appear here once submitted."
       />
     );
   ```

5. **Skeleton fidelity** — the skeleton mirrors the real layout's spacing and shape (reuse the same container classes). Use `text-muted-foreground` / `bg-muted` for placeholders.

6. **Verify** — `npm run tsc:check`, and confirm the skeleton causes no layout shift when content resolves.
