---
name: add-prisma-model
description: Add or change a Prisma model safely — relations, enums, indexes — then create the migration and update the service layer. Run manually; it touches the schema and database. Use when a feature needs a new model, field, relation, or enum.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Edit, Bash
---

# Add / change a Prisma model

Schema changes are high-risk; this runs only when you invoke it. Follow `.claude/docs/ENGINEERING.md` §2 (Data & Integrity).

## Steps

1. **Read `prisma/schema.prisma`** and match existing naming/conventions. Plan the change: model + fields, explicit relations for foreign keys, Prisma `enum`s for status-like fields (existing enum-naming style), and `@@index` on fields used in `where`/`orderBy` at scale.
2. **Edit the schema** with the minimal change. Keep it consistent with the neighborhood.
3. **Create the migration** (this writes to the dev database — review before running, and confirm `.env`/DB is the intended dev target):

   ```bash
   npm run prisma:migrate -- --name <migration_name>   # prisma migrate dev; pass --name (non-interactive). Never `npx prisma`.
   ```

   Inspect the generated SQL under `prisma/migrations/` for accidental data loss (drops, non-nullable columns without defaults on populated tables).

4. **Regenerate the client:** `npm run prisma:generate`.
5. **Update the data/action layer** — queries in `prisma/data/`, server actions in `prisma/actions/` (reuse shared `lib/` types): `select` needed fields, fetch relations with `include`/nested `select` (no N+1), multi-step writes in `prisma.$transaction`. Use Prisma-generated types, not hand-written duplicates.
6. **Verify** — `npm run tsc:check`.

> Migrations are committed with the feature. Call out the schema change explicitly in the PR/plan.
