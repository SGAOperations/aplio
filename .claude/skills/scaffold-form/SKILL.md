---
name: scaffold-form
description: Scaffold a form wired to a Server Action with shared zod validation, react-hook-form, shadcn Form primitives, and pending/error/success UI. Use when building any create/edit form in this Next.js app.
allowed-tools: Read, Grep, Glob, Edit, Write
---

# Scaffold a form

Wire a form to a Server Action with one zod schema as the source of truth for both client and server (client validation is UX; server validation is integrity — `.claude/docs/ENGINEERING.md` §2–4).

## Steps

1. **Read context.** Look at an existing form under `components/forms/` and the matching server action in `prisma/actions/`. Use the shadcn `Form`/`FieldGroup` primitives (`@/components/ui`) and `@hookform/resolvers/zod`. If the server action doesn't exist yet, scaffold it first (see the `scaffold-server-action` skill).
2. **Share the schema.** Define the zod schema once (co-located, or in `lib/` if shared — reuse existing) and import it on both sides. The server action re-parses input (never trust the client).
3. **Client component** (`'use client'`, smallest leaf):
   - `useForm({ resolver: zodResolver(schema) })`, shadcn `<Form>` + `<FormField>`/`<FormLabel>`/`<FormControl>`/`<FormMessage>` per field.
   - Submit calls the server action inside `try/catch`; disable the submit button while `isSubmitting` (spinner). On a returned `{ error }` → **specific error toast** (`sonner`) / inline `FormMessage`; on an unexpected `throw` → **generic error toast**; on success → **success toast** (and reset/redirect, using any returned record). Preserve input on failure. Never expect `{ ok }`.
   - Every input has a label; icon-only buttons get `aria-label`.
4. **Progressive enhancement** where practical (the `<form action={...}>` path works without JS).
5. **Tokens** — style via `.claude/docs/DESIGN.md` semantic tokens only; mobile-first widths.
6. **Verify** — `npm run tsc:check`; confirm error and pending states render.
