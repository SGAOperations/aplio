---
name: new-feature-slice
description: Build an end-to-end vertical slice of a feature for this Next.js + Prisma app — route, server-component data fetch, service layer, server action + form, and the three async states — following all project conventions. Use when implementing a self-contained feature from a clear spec.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# New feature slice (end-to-end)

Orchestrates the smaller skills into one vertical slice. Read `.claude/docs/ENGINEERING.md` and `.claude/docs/DESIGN.md` first; follow `CLAUDE.md` conventions throughout.

## Order of work

1. **Schema (if needed)** — add models/fields via the `add-prisma-model` skill (manual migration), then regenerate.
2. **Service layer** — query functions in `prisma/services/` that `select` only what's rendered and avoid N+1.
3. **Mutations** — server action(s) via the `scaffold-server-action` skill (auth + zod + scoping + typed result + revalidate).
4. **Route & data** — a server component page under `app/`, fetching via the service layer; `'use client'` only on small interactive leaves (run `rsc-boundary-check`).
5. **Form** — via the `scaffold-form` skill where the feature has input.
6. **States** — loading/error/empty via the `build-route-states` skill for every async surface.
7. **Polish** — `responsive-pass` and `a11y-audit` on the new UI; style only with `.claude/docs/DESIGN.md` tokens.
8. **Verify** — `npm run prettier:check && npm run eslint:check && npm run tsc:check`; fix all failures (never `eslint-disable`).

Keep the slice focused — don't refactor unrelated code (`.claude/docs/ENGINEERING.md` §7).
