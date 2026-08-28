# Engineering Standards

Every pipeline agent (plan, impl, review, revise) must read this document before working. It defines the quality bar for this codebase beyond the conventions in `CLAUDE.md`. Plans must account for these standards per feature, implementations must follow them, and review findings may cite sections of this document the same way they cite the plan.

Stack context: Next.js App Router, Prisma, Tailwind CSS 4, shadcn/ui, Stack Auth (`lib/auth/server.ts`), TypeScript strict, zod, react-hook-form.

## 1. Architecture

- **Server-first.** Every component is a server component until it provably needs interactivity, hooks, or browser APIs. Push `'use client'` to the smallest leaf possible — a page with one interactive button is a server page importing a small client component, not a client page.
- **Data flows one way.** Server components fetch via **data-fetching functions in `prisma/data/`**; mutations go through **server actions in `prisma/actions/`**; client components receive data as props. No fetching in client components, no API routes outside `CLAUDE.md`'s allowlist.
- **Avoid `useEffect`.** In this server-first codebase almost every `useEffect` is a mistake — data fetching, deriving state from props, or syncing state all have better homes (server components, values computed during render, event handlers, `key` to reset state, `nuqs` for URL state). **An empty-deps `useEffect(() => {…}, [])` is essentially never correct here** — it almost always hides fetching/initialization that belongs server-side, so treat it as a near-automatic review finding. Use `useEffect` **only** to synchronize with a genuinely external system (a non-React widget, a subscription, a DOM measurement) when there is no alternative, and justify it with a comment.
- **Composition over prop-drilling.** If a prop passes through more than two layers untouched, restructure: pass `children`, split the component, or fetch closer to where the data is used (server components make this cheap).
- **Co-location & layering.** Route-specific components live next to their route; anything used twice moves to `components/`. **Server actions live in `prisma/actions/`, data-fetching queries in `prisma/data/`**, grouped by domain (`applications.ts`, never a catch-all `actions.ts`). **Shared types and constants are global — `lib/types.ts` and `lib/constants.ts` — not per-service files.**
- **Abstract repetition, with judgment.** Logic, UI, types, constants, or zod schemas duplicated across **2+ places** get extracted to a single cohesive, intention-named home (`components/`, `lib/`, `prisma/{actions,data}/`). Don't abstract a single use or force unrelated cases into one helper (no premature/over-abstraction). Prefer composition and small focused units.
- **Small files, one responsibility.** A component file that needs scrolling to understand is two components. A service file mixing unrelated domains is two service files.

## 2. Data & Integrity

- **Select what you render — but prefer reusing shared types.** Default to `select`/`include` with explicit fields. **However, prefer reusing an existing/abstracted query type even if it pulls slightly more data than a given view strictly needs** — a little over-fetch is worth one reused type over many near-identical bespoke ones (see §1 abstraction). **Hard limit:** this never overrides the server/client boundary (§3) — never widen a `select` to include sensitive, internal, or other-users' fields that reach a **client** component.
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
  orderBy: { submittedAt: 'desc' },
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
- **Application status audit trail.** Every write that changes `Application.status` records an `ApplicationStatusEvent` in the same transaction — four paths do this today (`submitApplication`, `updateApplicationStatus`, `updateApplicationStatuses`, `withdrawApplication`); a fifth write path would otherwise silently skip the trail.
- **Validate at every boundary.** Every server action parses its input with a zod schema before touching the database — even when the form also validates client-side. Client validation is UX; server validation is integrity.
- **`EmailLog` delivery state is provider-reported and eventually consistent.** `sent` means handed off to Resend, not received — no UI should treat it as proof of delivery.

## 3. Security

- **Every server action authenticates.** First lines of every action: resolve the user and fail closed. Never trust IDs, roles, or ownership claims from the client.

```ts
'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { getCurrentUser } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';

const withdrawSchema = z.object({ applicationId: z.string().cuid() });

export async function withdrawApplication(input: unknown) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthenticated'); // unexpected from the UI → generic message (§4)

  const parsed = withdrawSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' }; // user-facing → toast

  // Authorization: scope the write to the caller — no IDOR
  const result = await prisma.application.updateMany({
    where: { id: parsed.data.applicationId, applicantId: user.id },
    data: { status: ApplicationStatus.WITHDRAWN },
  });
  if (result.count === 0) throw new Error('Application not found for caller'); // shouldn't be reachable from the UI

  revalidatePath('/applications');
  // success: return nothing (or the updated record if the caller needs it)
}
```

- **Authorization ≠ authentication.** Being logged in is not permission. Every query/mutation is scoped to what the caller may see or change (`where: { ..., applicantId: user.id }` or an explicit role check). Watch for IDOR: any action taking an ID must verify the caller's right to that specific record.
- **Never hand-roll a role check — use `lib/auth/guards.ts`** (`requireAdmin`, `requireManagerOrAdmin`, `requirePositionAccess`, `requireOwnership`, and the `*Or404` page twins). A bare `if (!user.isAdmin)` in an action or page is a review finding; the only `user.isAdmin` reads outside that module are nav rendering and query scoping.
- **Capability matrix.** Manager status is _derived_, not stored — no `role`/`isManager` column exists on `User` (`prisma/schema.prisma`); `isManager` counts non-deleted `Position.managers` rows (`prisma/data/managers.ts`). The full capability matrix, route/action gate tables, and the position/application state tables live in **`PERMISSIONS.md`** — read it, don't re-derive it here.

- **Denial shape depends on the surface, and only on that.** In a **server action** a guard **throws** — a denial is never user-facing, so it fails the §4 decision test and must never be returned as `{ error: 'Unauthorized' }`/`{ error: 'Forbidden' }`. In a **page** a guard calls **`notFound()`** — an authenticated-but-not-permitted page renders the same 404 as a missing one, so there is no existence leak and no silent `redirect('/')` to a page the user never asked for.
- **Authenticate before touching the DB.** Server actions are POST endpoints reachable by anyone holding the action id. Resolve the user _first_ — an existence check or stale-link lookup placed ahead of the guard turns the action into an anonymous existence oracle. `getCurrentUser` is `React.cache`d, so an early call costs a later guard nothing.
- **A thrown denial needs a client-side `catch`.** It rejects the caller's promise and never reaches the global error boundary on its own, so every call site wraps the action in `try`/`catch` and toasts the generic "Something went wrong. Please try again." — never the thrown message. Log the error so a real bug stays distinguishable from a stale-permission denial.
- **`redirect()` is routing, not denial.** Onboarding gates, resource-state bounces, and signed-out routing may still redirect; annotate them so they aren't mistaken for authorization.
- **No mass assignment.** Never spread client input into `data:`. Build the `data` object explicitly from parsed, whitelisted fields.
- **Server/client boundary.** No secrets, tokens, internal IDs beyond necessity, or other-users' data in props passed to client components. Anything serialized to the client is public to that user.
- **Dev-only code is env-gated.** Anything like `prisma/actions/dev-bypass.ts` must be impossible to trigger in production (explicit `NODE_ENV`/env-flag guard).
- **No raw SQL with interpolation.** Use Prisma query builders; if `$queryRaw` is unavoidable, use tagged-template parameters only.

## 4. UX Completeness

Every async surface ships **all three states** — loading, error, empty. A feature without them is incomplete, not minimal.

- **Loading:** wrap slow server-component subtrees in `<Suspense>` with a skeleton that matches the final layout (no layout shift on resolve). Route-level `loading.tsx` for whole-page fetches.
- **Error:** use **one global error boundary** — `app/global-error.tsx` (root shell) plus a single route-group `error.tsx` with a retry affordance — **not** a per-page `error.tsx` in every route folder. The boundary is only for **unexpected render / data-fetch errors**; expected errors never reach it.
- **Action results & feedback.** A server action either **succeeds** (returns nothing, or the relevant created/updated record) or returns **`{ error: 'message' }`** for a **user-facing** condition — **never `{ ok }`**. If something unexpected happens, **throw** (don't return a message that shouldn't be shown). **Every action gives toast feedback** (`sonner`): a success toast; a _specific_ error toast for a returned `{ error }`; a _generic_ error toast when the action **throws during an interaction**; a render-time throw hits the global boundary instead. Never leak internals.

  **Throw vs. return `{ error }` — the decision test:** _"Would you show this exact sentence to the end user, and can they act on it?"_ **Yes → `return { error: '…' }`. No → `throw`.**
  - **Return `{ error }`** — expected, user-actionable failures with safe copy: business-rule violations the user can resolve — e.g. `'Email already registered'`, `'This position is closed'`, `'You've already applied'`, `'Cycle is locked'`. (zod **field** errors usually surface inline on the form via the resolver, not as a returned `{ error }`.)
  - **`throw`** — unexpected / internal / not user-actionable: a failed auth or authorization check (shouldn't happen behind a gated UI), a record that _should_ exist but doesn't, DB / network / third-party failures, an unreachable `default:`/invariant, or anything whose message would leak internals. → generic toast (during an action) or global boundary (during render/data-fetch).
  - **Gray area — "not found":** reachable normally (a stale link to a deleted item) → `return { error: 'No longer available' }`; not reachable for this caller (an IDOR-style miss) → **throw**.

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

### Logging

A thrown error reaches Vercel's runtime logs with a stack and request context; a `console.error` string is a detached line with neither. Logging is not error reporting.

- **`console.log` never ships in application code** — `app/`, `components/`, `lib/`, `prisma/actions/`, `prisma/data/`. Debug logging is a local tool; it comes out before the PR.
- **`console.error` is not error handling.** Catch-log-continue hides the failure from the user _and_ leaves nothing actionable in the logs. The default for an unexpected failure is to **throw** — the error model above already routes it: generic toast during an interaction, global boundary during render/data-fetch.
- **Preserve the cause when rethrowing:** `throw new Error('Failed to …', { cause: err })` — never log the original and throw a bare new one.
- **Never `catch` purely to silence.** An empty or log-only catch carries a one-line comment stating the invariant that makes swallowing correct (§7's comment bar applies); without it, it's a bug.
- **The permitted logging sites, and no others:**
  - **Standalone scripts** off the request/render path (`prisma/seed.ts`) — progress output is fine.
  - **Fail-open paths** where degrading beats throwing (`lib/rate-limit.ts` — a limiter that's down must not take the app down). The comment states why it cannot throw.
  - **A client `catch` that also toasts** — the §3-mandated wrapper around a server action, where the log keeps a real bug distinguishable from a stale-permission denial. Logging with **no** toast is not exempt.
  - **A server-side cause the browser can't see** (`prisma/actions/auth.ts`) — log the upstream error, return `{ error }` with safe copy.
  - **Best-effort side effects get no automatic exemption.** Where the caller can retry (a webhook whose 500 is retried), **throw** — `lib/email/resend.ts`. Log-and-continue only where the side effect is genuinely non-retryable _and_ non-critical, with the invariant comment.

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
- **Comments are rare, one line by default.** Default to none — name things so the code reads without help. Write one only where a reader fluent in the language and this codebase would still get it wrong: a non-obvious invariant, an external requirement, a deliberate exclusion, or a workaround for someone else's bug.
  - **One line. Two only rarely**, when a single constraint genuinely cannot compress further (JSDoc `/**` and `*/` delimiters don't count). Three is always wrong — restructure the code, or put the narrative in the PR body where it belongs.
  - **Terse fragments, not sentences.** Drop the subject, the hedging, and the connective tissue: `// Spoofable — server re-sniffs.` not `// Note that file.type is client-supplied and therefore spoofable, so the server checks it again.`
  - **No provenance.** Never cite an issue, PR, review thread, or `ENGINEERING §` ref. `git blame` links every line to its PR and its review permanently; a hardcoded `#334` only rots.
  - **No narration.** Never restate what the next line does; never label an obvious section.
  - **Function docs get the same bar.** A JSDoc block only where the contract isn't clear from the name and signature, and no `@param`/`@returns` that merely restate types.

  ```ts
  // before — 5 lines, provenance ref, restates what the code already says
  // Sentinel used only for RadioGroup/RadioGroupItem value comparisons on the
  // virtual "Other" choice — kept distinct from OTHER_OPTION_LABEL so an
  // admin-authored option literally named "Other" can never collide with the
  // virtual choice (see PR #334 review).

  // after — the one fact a reader cannot infer
  // Distinct from OTHER_OPTION_LABEL so a real option named "Other" can't collide.
  ```

- **Leave it better, narrowly.** Fix problems in code you touch when they affect your change; do not refactor unrelated code in a feature PR.

## 8. Pre-PR self-check (shared by impl, revise, and review)

A scannable summary of the issues that recur in this codebase. **impl** builds to it, **revise** must not reintroduce these, and **review** uses it as its dimensions. Detail lives in the sections above.

- **Server actions:** authenticate, zod-parse input, scope writes to the caller (no IDOR). **Return `void`/relevant data on success, `{ error }` for user-facing failures, `throw` for unexpected ones — never `{ ok }`.** Decision test: _would you show this exact sentence to the user, and can they act on it?_ yes → `{ error }`, no → throw. (§3, §4)
- **Feedback:** **every action shows a toast** (`sonner`) — success, specific error for `{ error }`, generic on an unexpected throw; `revalidatePath`/`revalidateTag` after writes. (§4)
- **Errors:** **one global boundary** (`global-error.tsx` + a single route-group `error.tsx`), **never per-page `error.tsx`**; expected errors are toasts, not the boundary. (§4)
- **Logging:** no `console.log` in app code; unexpected failures **throw** (Vercel logs them with a stack and request context) rather than being logged and swallowed; every `console.error` sits on a documented fail-open path, a script, or a client catch that toasts. (§4)
- **Queries:** `select` what's rendered but **reuse shared `lib` types** (slight over-fetch OK; never sensitive/internal/other-users' fields to a client); no N+1; `$transaction` for multi-step writes. (§2)
- **Async states:** every async surface ships loading + empty (plus the error model above). (§4)
- **Components:** server-first; `'use client'` only on the smallest leaf; **no `useEffect` (empty-deps especially)**; **shadcn/Radix primitives, not hand-rolled raw elements**; role-gate nav where the route is role-gated. (§1, §5)
- **Structure & conventions:** server actions in `prisma/actions/`, queries in `prisma/data/`; **shared types/constants in `lib/types.ts`/`lib/constants.ts`** (not per-service); abstract repetition sensibly (no over-abstraction); named exports only (except route files); no API routes outside `CLAUDE.md`'s allowlist; **design tokens, never hardcoded colors**; strict TS, no `any`. (§1, §7)
- **Hygiene:** no dead scaffolding/shims/transitional re-exports; schema changes ship with their migration. (§1)
- **Comments:** rare, **one line by default** (two only rarely, never three); terse fragments, not sentences; **no issue/PR/`§` refs**, no narration; JSDoc only where the signature doesn't already say it. (§7)

## 9. Next.js 16 runtime notes (App Router)

Current-behavior reference so agents don't code from stale training data. This repo is on **Next.js 16.2.9, React 19**. When in doubt about caching/rendering, **fetch the canonical page** (links below) rather than recalling — the model has changed across versions.

> Fetch live docs: `nextjs.org/docs/llms.txt` is a machine-readable index; most pages also have a `.md` form. Allowlisted for `WebFetch` in `.claude/settings.json`.

### Caching model in THIS repo: the "previous" model (Cache Components is OFF)

`next.config.ts` does **not** set `cacheComponents: true`, so the **previous caching model applies — not Cache Components / PPR.** Do not write `use cache`, `cacheLife`, or `cacheTag` here; those belong to Cache Components, which is not enabled.

What that means in practice:

- Data is fetched in **server components** via data-fetching functions in `prisma/data/`. Reading request data (`cookies()`, `headers()`, `searchParams`) opts a route into **dynamic (request-time) rendering** — expected for authed, per-user pages.
- After a mutation, refresh caches explicitly with **`revalidatePath(path)`** or **`revalidateTag(tag)`** from the server action. This is the canonical pattern; always revalidate after a write.
- Reference (previous model): https://nextjs.org/docs/app/guides/caching-without-cache-components and https://nextjs.org/docs/app/getting-started/revalidating

**If you ever enable Cache Components** (`cacheComponents: true`), the rules change substantially (PPR default, `use cache`/`cacheLife`/`cacheTag`, `updateTag`, "Uncached data accessed outside `<Suspense>`" build errors, `connection()` before non-deterministic ops). Read https://nextjs.org/docs/app/getting-started/caching first — and that is a deliberate architectural change, not a casual edit.

### Proxy (formerly Middleware) — v16.0.0 breaking change

`middleware.ts` is **deprecated** in Next.js 16. The file convention is now `proxy.ts` and the exported function must be named `proxy` (not `middleware`):

```ts
// proxy.ts — at the project root (or src/)
export function proxy(request: NextRequest) { ... }
export const config = { matcher: [...] }
```

- Rename `middleware.ts` → `proxy.ts`
- Rename `export function middleware` → `export function proxy`
- Type is `NextProxy` (not `NextMiddleware`)
- Official codemod: `npx @next/codemod@canary middleware-to-proxy .`
- `NextRequest`, `NextResponse`, `config.matcher` are all unchanged

### Stable rules (true regardless of caching model)

- **Server vs Client Components** — server by default; `'use client'` only for interactivity/hooks/browser APIs, on the smallest leaf. Prisma/secrets never reach a client component. Ref: https://nextjs.org/docs/app/getting-started/server-and-client-components
- **Server Actions** — `'use server'`, used for all mutations and form `action`s; progressive enhancement; validate input with zod; return `void`/data on success, `{ error }` for user-facing failures, `throw` for unexpected ones (§4). Ref: https://nextjs.org/docs/app/getting-started/updating-data
- **Streaming** — wrap slow async server subtrees in `<Suspense>` with a skeleton; use route-level `loading.tsx` for whole-page fetches; errors go through the global boundary (§4), never a per-page `error.tsx`.
- **Dynamic APIs are async in 16** — `await cookies()`, `await headers()`, and `params`/`searchParams` are promises in page props. Don't access them synchronously.
- **Routing** — route groups `(group)`, dynamic segments `[id]`, `generateStaticParams` for static dynamic routes, `generateMetadata` for metadata.

### Canonical links (fetch the `.md` form for current detail)

- App Router index: https://nextjs.org/docs/app
- Caching (Cache Components): https://nextjs.org/docs/app/getting-started/caching
- Caching (previous model — **this repo**): https://nextjs.org/docs/app/guides/caching-without-cache-components
- Revalidating: https://nextjs.org/docs/app/getting-started/revalidating
- Server & Client Components: https://nextjs.org/docs/app/getting-started/server-and-client-components
- Updating data / Server Actions: https://nextjs.org/docs/app/getting-started/updating-data
- Docs index for agents: https://nextjs.org/docs/llms.txt
