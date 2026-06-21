---
name: rsc-boundary-check
description: Audit a feature for correct React Server/Client Component boundaries — flag needless 'use client', useEffect data fetching, Prisma or secrets leaking into client components, and oversized client subtrees. Use after building UI or when reviewing a feature's architecture.
allowed-tools: Read, Grep, Glob, Edit
---

# RSC boundary check

Enforce the server-first rules in `CLAUDE.md` and `.claude/docs/ENGINEERING.md` §1 and §6.

## What to flag

1. **Needless `'use client'`** — a component marked client that has no interactivity/hooks/browser APIs. Push the directive to the smallest leaf; make the page a server component that imports a small client island.
2. **`useEffect` for data fetching or state sync** — forbidden. Move the fetch to a server component / service function and pass data as props.
3. **Prisma or secrets in a client component** — any `@/lib/prisma`, service import, env secret, or `getCurrentUser()` reached from a `'use client'` file. Server-only data must not cross the boundary; only serialize what's safe.
4. **Oversized client subtrees** — large trees marked client when only a button/input needs it. Recommend the split.
5. **Missing `server-only`** — service modules that should import `server-only` to fail loudly if imported client-side.

## How

Grep for `'use client'`, `useEffect`, `@/lib/prisma`, and service imports across the feature; read each client file and trace what it imports. Report findings as `path:line — issue → fix`. Apply the safe mechanical fixes (move directive, split component) when unambiguous; leave judgment calls for the human.
