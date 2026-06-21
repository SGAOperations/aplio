# Next.js 16 notes (App Router)

Current-behavior reference so agents don't code from stale training data. This repo is on **Next.js 16.2.9, React 19**. When in doubt about caching/rendering, **fetch the canonical page** (links below) rather than recalling — the model has changed across versions.

> Fetch live docs: `nextjs.org/docs/llms.txt` is a machine-readable index; most pages also have a `.md` form. Allowlisted for `WebFetch` in `.claude/settings.json`.

## Caching model in THIS repo: the "previous" model (Cache Components is OFF)

`next.config.ts` does **not** set `cacheComponents: true`, so the **previous caching model applies — not Cache Components / PPR.** Do not write `use cache`, `cacheLife`, or `cacheTag` here; those belong to Cache Components, which is not enabled.

What that means in practice:
- Data is fetched in **server components** via Prisma service functions (`prisma/services/`). Reading request data (`cookies()`, `headers()`, `searchParams`) opts a route into **dynamic (request-time) rendering** — expected for authed, per-user pages.
- After a mutation, refresh caches explicitly with **`revalidatePath(path)`** or **`revalidateTag(tag)`** from the server action. This is the canonical pattern; always revalidate after a write.
- Reference (previous model): https://nextjs.org/docs/app/guides/caching-without-cache-components and https://nextjs.org/docs/app/getting-started/revalidating

**If you ever enable Cache Components** (`cacheComponents: true`), the rules change substantially (PPR default, `use cache`/`cacheLife`/`cacheTag`, `updateTag`, "Uncached data accessed outside `<Suspense>`" build errors, `connection()` before non-deterministic ops). Read https://nextjs.org/docs/app/getting-started/caching first — and that is a deliberate architectural change, not a casual edit.

## Stable rules (true regardless of caching model)

- **Server vs Client Components** — server by default; `'use client'` only for interactivity/hooks/browser APIs, on the smallest leaf. Prisma/secrets never reach a client component. Ref: https://nextjs.org/docs/app/getting-started/server-and-client-components
- **Server Actions** — `'use server'`, used for all mutations and form `action`s; progressive enhancement; validate input with zod; return a typed `{ ok, error }`. Ref: https://nextjs.org/docs/app/getting-started/updating-data
- **Streaming** — wrap slow async server subtrees in `<Suspense>` with a skeleton; use route-level `loading.tsx` for whole-page fetches and `error.tsx` for error boundaries.
- **Dynamic APIs are async in 16** — `await cookies()`, `await headers()`, and `params`/`searchParams` are promises in page props. Don't access them synchronously.
- **Routing** — route groups `(group)`, dynamic segments `[id]`, `generateStaticParams` for static dynamic routes, `generateMetadata` for metadata.

## Canonical links (fetch the `.md` form for current detail)

- App Router index: https://nextjs.org/docs/app
- Caching (Cache Components): https://nextjs.org/docs/app/getting-started/caching
- Caching (previous model — **this repo**): https://nextjs.org/docs/app/guides/caching-without-cache-components
- Revalidating: https://nextjs.org/docs/app/getting-started/revalidating
- Server & Client Components: https://nextjs.org/docs/app/getting-started/server-and-client-components
- Updating data / Server Actions: https://nextjs.org/docs/app/getting-started/updating-data
- Docs index for agents: https://nextjs.org/docs/llms.txt
