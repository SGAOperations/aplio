---
name: build-route-states
description: Add the three required async states — loading, error, and empty — to a Next.js App Router route or data-driven component, per .claude/docs/ENGINEERING.md §4. Use when a route fetches data and is missing loading.tsx, error.tsx, a Suspense skeleton, or a designed empty state.
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

3. **Error** — add `error.tsx` (a client component) for the segment, with a retry affordance via `reset()`:

   ```tsx
   'use client';
   export default function Error({ reset }: { error: Error; reset: () => void }) {
     return (
       <div className="text-card-foreground rounded-lg border border-border p-6">
         <p className="text-sm">Something went wrong loading this page.</p>
         <button onClick={reset} className="mt-2 text-sm text-primary">Try again</button>
       </div>
     );
   }
   ```

   Server actions return typed `{ ok, error }` — surface those inline in forms; never render an unhandled throw as a blank screen.

4. **Empty** — zero-item lists render a designed empty state (icon + one-line explanation + primary action), not a blank container:

   ```tsx
   if (items.length === 0)
     return <EmptyState title="No applications yet" description="Applications appear here once submitted." />;
   ```

5. **Skeleton fidelity** — the skeleton mirrors the real layout's spacing and shape (reuse the same container classes). Use `text-muted-foreground` / `bg-muted` for placeholders.

6. **Verify** — `npm run tsc:check`, and confirm the skeleton causes no layout shift when content resolves.
