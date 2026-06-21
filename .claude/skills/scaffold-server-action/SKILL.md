---
name: scaffold-server-action
description: Scaffold a new Server Action in prisma/services/ following Aplio conventions — auth check, zod validation, authorization scoping, typed result, and cache revalidation. Use when adding a mutation (create/update/delete/submit/withdraw) for this Next.js + Prisma app.
allowed-tools: Read, Grep, Glob, Edit, Write
---

# Scaffold a Server Action

Generate a mutation as a Server Action in `prisma/services/`, meeting `.claude/docs/ENGINEERING.md` §2–3. Never put mutations in API routes or client components.

## Steps

1. **Read context.** Skim `.claude/docs/ENGINEERING.md` §2 (Data & Integrity) and §3 (Security), and an existing file in `prisma/services/` to match the neighborhood's naming and style. Confirm the auth helper (`@/lib/auth/server`) and Prisma client import paths used in this repo.
2. **Place it by domain.** Add to the matching domain file (e.g. `prisma/services/application-actions.ts`), or create one named by domain — never a catch-all `actions.ts`.
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
     if (!user) return { ok: false as const, error: 'Not authenticated' };

     const parsed = inputSchema.safeParse(input);
     if (!parsed.success) return { ok: false as const, error: 'Invalid input' };

     // Authorization: scope to the caller — never trust client-supplied ownership
     const result = await prisma.model.updateMany({
       where: { id: parsed.data.id, ownerId: user.id },
       data: {
         /* explicit, parsed fields only */
       },
     });
     if (result.count === 0) return { ok: false as const, error: 'Not found' };

     revalidatePath('/relevant-path'); // or revalidateTag(...)
     return { ok: true as const };
   }
   ```

4. **Multi-step writes** → wrap in `prisma.$transaction` (e.g. mutation + audit log) so partial failure can't corrupt state.
5. **Type safety** — input is `unknown` until zod parses it; use Prisma-generated types for results; no `any`.
6. **Wire-up note** — remind the caller how the form/component should consume the `{ ok, error }` result (inline error, preserved input, success feedback). For the form side, pair with the form scaffold.
7. **Verify** — run `npm run tsc:check` on the new file.
