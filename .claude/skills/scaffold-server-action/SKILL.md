---
name: scaffold-server-action
description: Scaffold a new Server Action in prisma/actions/ following Aplio conventions — auth check, zod validation, authorization scoping, void/data-or-{error} return (throw for unexpected), toast feedback, and cache revalidation. Use when adding a mutation (create/update/delete/submit/withdraw) for this Next.js + Prisma app.
allowed-tools: Read, Grep, Glob, Edit, Write
---

# Scaffold a Server Action

Generate a mutation as a Server Action in `prisma/actions/`, meeting `.claude/docs/ENGINEERING.md` §2–4. Never put mutations in API routes or client components.

## Steps

1. **Read context.** Skim `.claude/docs/ENGINEERING.md` §2 (Data & Integrity), §3 (Security), §4 (action returns + toasts), and an existing file in `prisma/actions/` to match the neighborhood's naming and style. Confirm the auth helper (`@/lib/auth/server`) and Prisma client import paths. **Reuse shared types/constants from `lib/types.ts` / `lib/constants.ts`** — don't create per-service ones.
2. **Place it by domain.** Add to the matching domain file in **`prisma/actions/`** (e.g. `prisma/actions/applications.ts`), or create one named by domain — never a catch-all `actions.ts`. (Data-fetching queries live in `prisma/data/`, not here.)
3. **Follow this shape** (adapt names/fields; build `data` explicitly from parsed fields — no mass assignment; scope every write to the caller to prevent IDOR):

   ```ts
   'use server';

   import { revalidatePath } from 'next/cache';

   import { z } from 'zod';

   import { getCurrentUser } from '@/lib/auth/server';
   import { prisma } from '@/lib/prisma';

   const inputSchema = z.object({
     id: z.string().cuid() /* …whitelisted fields */,
   });

   export async function doThing(input: unknown) {
     const user = await getCurrentUser();
     if (!user) throw new Error('Unauthenticated'); // unexpected in the UI → generic toast/boundary

     const parsed = inputSchema.safeParse(input);
     if (!parsed.success) return { error: 'Invalid input' }; // user-facing → specific toast

     // Authorization: scope to the caller — never trust client-supplied ownership
     const result = await prisma.model.updateMany({
       where: { id: parsed.data.id, ownerId: user.id },
       data: {
         /* explicit, parsed fields only */
       },
     });
     if (result.count === 0) throw new Error('Not found for caller'); // shouldn't be reachable from the UI

     revalidatePath('/relevant-path'); // or revalidateTag(...)
     // success: return nothing (or the created/updated record if the caller needs it)
   }
   ```

4. **Multi-step writes** → wrap in `prisma.$transaction` (e.g. mutation + audit log) so partial failure can't corrupt state.
5. **Type safety** — input is `unknown` until zod parses it; use Prisma-generated types for results; no `any`.
6. **Wire-up & feedback** — the caller checks `if (result && 'error' in result)` → **specific error toast**; on success → **success toast** (and uses the returned record if any); an unexpected `throw` surfaces a **generic error toast** (`sonner`). Preserve input on failure. Pair with the form scaffold. (Errors that must **not** be shown to the user are thrown, not returned — §4.)
7. **Verify** — run `npm run tsc:check` on the new file.
