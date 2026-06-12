# Engineering Standards

Every pipeline agent (plan, impl, review, revise) must read this document before working. It defines the quality bar for this codebase beyond the conventions in `CLAUDE.md`. Plans must account for these standards per feature, implementations must follow them, and review findings may cite sections of this document the same way they cite the plan.

Stack context: Next.js App Router, Prisma, Tailwind CSS 4, shadcn/ui, Stack Auth (`lib/auth/server.ts`), TypeScript strict, zod, react-hook-form.

## 1. Architecture

- **Server-first.** Every component is a server component until it provably needs interactivity, hooks, or browser APIs. Push `'use client'` to the smallest leaf possible — a page with one interactive button is a server page importing a small client component, not a client page.
- **Data flows one way.** Server components fetch via service functions in `prisma/services/`; mutations go through server actions in `prisma/services/`; client components receive data as props. No fetching in client components, no `useEffect` synchronization, no API routes (except `/api/auth`).
- **Composition over prop-drilling.** If a prop passes through more than two layers untouched, restructure: pass `children`, split the component, or fetch closer to where the data is used (server components make this cheap).
- **Co-location.** Route-specific components live next to their route; anything used twice moves to `components/`. Service functions are grouped by domain (`application-actions.ts`, not `actions.ts`).
- **Small files, one responsibility.** A component file that needs scrolling to understand is two components. A service file mixing unrelated domains is two service files.

## 2. Data & Integrity

- **Select only what you render.** Default to `select`/`include` with explicit fields on every Prisma query touching user-facing lists. Never ship full rows to the client when three fields are rendered.
- **No N+1.** Fetch relations with `include`/nested `select` in one query, never by mapping over results and querying per item.

```ts
const applications = await prisma.application.findMany({
  where: { cycleId },
  select: {
    id: true,
    status: true,
    submittedAt: true,
    applicant: { select: { id: true, name: true } },
  },
  orderBy: { submittedAt: "desc" },
});
```

- **Transactions for multi-step writes.** Any mutation that writes more than one record (or reads-then-writes) runs in `prisma.$transaction` so partial failure cannot corrupt state:

```ts
await prisma.$transaction(async (tx) => {
  const application = await tx.application.update({
    where: { id: applicationId },
    data: { status: ApplicationStatus.SUBMITTED, submittedAt: new Date() },
  });
  await tx.auditLog.create({
    data: { applicationId: application.id, action: AuditAction.SUBMIT, userId },
  });
});
```

- **Schema discipline.** Status-like fields are Prisma `enum`s following existing enum naming; foreign keys get explicit relations; fields queried in `where`/`orderBy` at scale get `@@index`. Schema changes always come with the corresponding migration and are called out in the plan.
- **Validate at every boundary.** Every server action parses its input with a zod schema before touching the database — even when the form also validates client-side. Client validation is UX; server validation is integrity.

## 3. Security

- **Every server action authenticates.** First lines of every action: resolve the user and fail closed. Never trust IDs, roles, or ownership claims from the client.

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

const withdrawSchema = z.object({ applicationId: z.string().cuid() });

export async function withdrawApplication(input: unknown) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };

  const parsed = withdrawSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };

  // Authorization: scope the write to the caller — no IDOR
  const result = await prisma.application.updateMany({
    where: { id: parsed.data.applicationId, applicantId: user.id },
    data: { status: ApplicationStatus.WITHDRAWN },
  });
  if (result.count === 0) return { ok: false as const, error: "Not found" };

  revalidatePath("/applications");
  return { ok: true as const };
}
```

- **Authorization ≠ authentication.** Being logged in is not permission. Every query/mutation is scoped to what the caller may see or change (`where: { ..., applicantId: user.id }` or an explicit role check). Watch for IDOR: any action taking an ID must verify the caller's right to that specific record.
- **No mass assignment.** Never spread client input into `data:`. Build the `data` object explicitly from parsed, whitelisted fields.
- **Server/client boundary.** No secrets, tokens, internal IDs beyond necessity, or other-users' data in props passed to client components. Anything serialized to the client is public to that user.
- **Dev-only code is env-gated.** Anything like `prisma/services/dev-bypass.ts` must be impossible to trigger in production (explicit `NODE_ENV`/env-flag guard).
- **No raw SQL with interpolation.** Use Prisma query builders; if `$queryRaw` is unavoidable, use tagged-template parameters only.

## 4. UX Completeness

Every async surface ships **all three states** — loading, error, empty. A feature without them is incomplete, not minimal.

- **Loading:** wrap slow server-component subtrees in `<Suspense>` with a skeleton that matches the final layout (no layout shift on resolve). Route-level `loading.tsx` for whole-page fetches.
- **Error:** route segments with data fetching get an `error.tsx` boundary with a retry affordance. Server actions return typed `{ ok, error }` results that the form surfaces inline — never a silent failure or an unhandled throw rendered as a blank screen.
- **Empty:** zero-item lists render a designed empty state (icon, one-line explanation, primary action), not a blank container.

```tsx
<Suspense fallback={<ApplicationListSkeleton />}>
  <ApplicationList cycleId={cycle.id} />
</Suspense>;

// inside ApplicationList (server component)
if (applications.length === 0)
  return (
    <EmptyState
      title="No applications yet"
      description="Applications will appear here once submitted."
    />
  );
```

- **Forms:** pending state on submit (disabled button + spinner via `useFormStatus` or react-hook-form `isSubmitting`), inline field errors from zod, preserved input on failure, success feedback (toast or redirect). Progressive enhancement where practical.
- **Mutations feel instant.** After a successful action: `revalidatePath`/`revalidateTag` always; optimistic UI where the interaction is high-frequency (toggles, votes).

## 5. Accessibility

- **Semantic HTML first.** Buttons are `<button>`, navigation is `<nav>`, headings are hierarchical (`h1` → `h2`, no skips). ARIA only when no semantic element exists.
- **Keyboard.** Every interaction works without a mouse: visible focus rings (never `outline-none` without a replacement), logical tab order, Escape closes overlays.
- **Focus management.** Dialogs/sheets trap focus while open and return it to the trigger on close — shadcn/Radix primitives do this; don't break it with custom wrappers.
- **Labels.** Every input has an associated `<label>` (shadcn `FormLabel`); icon-only buttons get `aria-label`; images get meaningful `alt` (or `alt=""` if decorative).
- **Contrast & targets.** Text meets WCAG AA contrast against its actual background; touch targets are at least ~44px on mobile.

## 6. Performance

- **Cache deliberately.** Know whether each fetch is static, revalidated, or dynamic — and say so in the plan. Use `revalidateTag`/`revalidatePath` rather than opting whole routes out of caching.
- **Stream what's slow.** Independent slow sections get their own `<Suspense>` boundary so fast content paints immediately.
- **Ship less JS.** Adding `'use client'` to a large subtree, or a new dependency, is a bundle decision — justify it. Prefer server rendering + small client islands.
- **Images via `next/image`** with proper `sizes`; no unoptimized `<img>` for content images.
- **Query cost.** Paginate unbounded lists (`take`/`cursor`); aggregate in the database (`_count`, `groupBy`), not in JS over full tables.

## 7. Quality Bar

- **Strict TypeScript, no `any`** — including no `as any` escapes. Unavoidable unknowns are `unknown` + narrowing. Server action inputs are `unknown` until zod parses them.
- **Exhaustiveness.** `switch` over enums/unions handles every case, with a `never` default to break the build when a case is added.
- **Prisma-generated types** (`Prisma.ApplicationGetPayload<...>`, generated enums) over hand-written duplicates that drift.
- **Naming follows the neighborhood.** Match the file's existing patterns for casing, ordering, and component structure before introducing anything new.
- **Comments explain constraints, not code.** A comment states a non-obvious invariant or external requirement; it never narrates what the next line does.
- **Leave it better, narrowly.** Fix problems in code you touch when they affect your change; do not refactor unrelated code in a feature PR.
