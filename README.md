# Aplio

Aplio is an internal recruiting and application platform. Admins and managers create **positions** with custom **questions**; applicants build a profile and submit **applications**; managers move applications through a review pipeline (`draft → applied → reached_out → interview_scheduled → reviewing → accepted / rejected / withdrawn`). The platform is designed for operational teams that need structured, configurable hiring workflows without the overhead of general-purpose ATS products.

## Tech stack

| Layer          | Technology                                         |
| -------------- | -------------------------------------------------- |
| Framework      | Next.js 16 (App Router, React 19, Turbopack)       |
| Database / ORM | Prisma 7 (`@prisma/adapter-pg`) · Neon Postgres    |
| Auth           | Better Auth (self-hosted, email OTP)               |
| Styling        | Tailwind CSS 4 · shadcn/ui (Radix, new-york style) |
| Language       | TypeScript (strict)                                |
| Validation     | zod 4 · react-hook-form                            |
| Notifications  | sonner                                             |

## Getting started

### Prerequisites

- **Node.js** version pinned in `package.json`'s `engines` field
- **npm** (comes with Node)
- **Docker** (for a local Postgres instance via `docker-compose.yml`) **or** a hosted Neon Postgres URL

### 1. Environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in the required variables:

| Variable                | Description                                                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | Postgres connection string (pooled). Local Docker: `postgresql://admin:admin@localhost:5432/aplio`                                                                                          |
| `DIRECT_URL`            | Direct (non-pooled) connection string. Local Docker: same as `DATABASE_URL`                                                                                                                 |
| `BETTER_AUTH_SECRET`    | Signs session cookies. At least 32 characters: `openssl rand -base64 32`                                                                                                                    |
| `BETTER_AUTH_URL`       | Production only, pinned to the real domain. Preview/local derive it from `VERCEL_URL`, else `http://localhost:3000`. Also governs the absolute URLs (logo, sign-in link) in outgoing email. |
| `RESEND_API_KEY`        | Resend API key for transactional email delivery                                                                                                                                             |
| `RESEND_FROM_EMAIL`     | Verified sender address in Resend (e.g. `noreply@yourdomain.com`)                                                                                                                           |
| `RESEND_WEBHOOK_SECRET` | Signing secret for the Resend webhook that reports delivery events (Resend dashboard → the webhook)                                                                                         |

> **Note:** Prisma CLI commands (`prisma:migrate`, `prisma:seed`) read from `.env`; Next.js reads `.env.local`. Both files are gitignored. For local development you can keep the same values in both.

### 2. Install dependencies

```bash
npm ci
```

### 3. Start the local database (Docker path only)

```bash
npm run db:start
```

This spins up a Postgres 16 container (`admin`/`admin`, database `aplio`, port `5432`). Skip this step if you are using a hosted Neon URL.

### 4. Run migrations and generate the Prisma client

```bash
npm run prisma:migrate
npm run prisma:generate
```

### 5. (Optional) Seed demo data

```bash
npm run prisma:seed
```

### 6. Start the dev server

```bash
npm run dev
```

The app runs at <http://localhost:3000>.

## npm scripts

| Script            | Description                                              |
| ----------------- | -------------------------------------------------------- |
| `dev`             | Start Next.js dev server with Turbopack                  |
| `build`           | Generate Prisma client, then build for production        |
| `start`           | Run the production build                                 |
| `prisma:generate` | Regenerate the Prisma client from `prisma/schema.prisma` |
| `prisma:migrate`  | Create and apply a new migration (`prisma migrate dev`)  |
| `prisma:seed`     | Run the seed script at `prisma/seed.ts`                  |
| `db:start`        | Start the local Postgres Docker container                |
| `db:stop`         | Stop the local Postgres Docker container                 |
| `db:reset`        | Reset the database and re-run all migrations             |
| `test`            | Run the full suite (unit + db projects, used in CI)      |
| `test:unit`       | Run only the no-database unit project                    |
| `test:watch`      | Run the suite in watch mode                              |
| `prettier:fix`    | Format all files with Prettier                           |
| `prettier:check`  | Check formatting (used in CI)                            |
| `eslint:check`    | Lint with zero warnings allowed (used in CI)             |
| `eslint:fix`      | Auto-fix lint issues                                     |
| `tsc:check`       | Type-check without emitting (used in CI)                 |

> Always run Prisma through `npm run prisma:*` — never `npx prisma` directly.

## Running tests

Two Vitest projects: `unit` (pure functions, no database, in `tests/unit/`) and `db` (real Postgres, real Prisma, real guards, in `tests/db/`). All tests live under `tests/`, never co-located with the source files they cover.

```bash
npm run db:start
npm run prisma:generate
npm run test
```

`npm run db:start` first — the `db` project connects to whatever `DATABASE_URL` points at and writes/deletes rows there (scoped to a `vitest-` prefix and swept on every run), so never point it at a remote or production database. `npm run test:unit` runs only the no-database subset and is useful when Postgres isn't available locally; CI always runs the full suite.

## Deployment & databases

Preview databases come from the **Neon Previews Integration** (installed on the Vercel project) — it owns per-PR branch creation, `DATABASE_URL`/`DATABASE_URL_UNPOOLED` injection, and branch teardown. There is no bespoke workflow for this anymore.

Preview migrations run inside the Vercel build itself, driven by `vercel.json`'s `buildCommand`: when `VERCEL_ENV` is `preview`, it runs `prisma migrate deploy` against `DATABASE_URL_UNPOOLED` (required — the pooled endpoint rejects `migrate deploy`) before the normal build. On Production and Development deploys the guard is false, so the command is just `npm run build`, unchanged.

`dev` and `main` are migrated the existing way, via `.github/workflows/migrate-db.yml` on push — that workflow is untouched by the above.

`.github/workflows/neon-branch-check.yml` checks the live branch count on every PR push and **fails when the project is at its cap**, so a quota-blocked preview is distinguishable from a broken build without opening the Neon console; the count and full branch inventory are in the run log. It needs two Actions secrets — `NEON_API_KEY` and `NEON_PROJECT_ID`, the same values the app already uses at runtime (see `.env.example`) — and an optional `NEON_BRANCH_LIMIT` repository variable, which defaults to `10`. That limit is configuration rather than something the workflow discovers, because Neon's API exposes no quota endpoint. **Never add this check to the required status checks:** it goes red at capacity by design, and making it required would block merges on top of `Vercel` instead of merely reporting.

Preview branches are a **project-wide, finite pool**: Neon allows 10 branches and 2 are permanently held (`dev`, `production`), leaving **~8 usable for previews**. Every open PR with a preview deployment consumes one, and merging or closing that PR frees it automatically — there is no manual cleanup step. When the pool is exhausted the integration cannot attach a branch, so `DATABASE_URL_UNPOOLED` is never injected and the preview build fails on the Prisma datasource — the branch-budget check above is what identifies that as a quota problem. To reclaim capacity, merge or close an open PR; the next push to a blocked branch redeploys into the freed slot.

### Dev bypass

`isBypassAllowed()` (`lib/utils.ts`) is the single gate for both issuing and accepting the `dev-bypass-user-id` cookie, keyed off `VERCEL_ENV`. It's deliberately true for `preview`: each preview runs against its own per-PR Neon branch (never production data), and bypass login is the only practical way to exercise every role there without minting real OTP sessions. Locally, set `VERCEL_ENV=development` (see `.env.example`) or `/login/bypass` 404s.

## Project structure

```
app/
  (main)/         # Authenticated app shell
    (auth)/         # Routes requiring login (applications, positions, users, etc.)
    profile/        # User profile page
  (public)/       # Unauthenticated public routes (position listings)
  (app)/          # App-level layout wrappers
  (legal)/        # Privacy / terms pages
  login/          # Login and auth bypass (dev only)
  api/auth/       # Auth callback route (the only API route)
  layout.tsx      # Root layout
  globals.css     # Tailwind theme tokens

components/
  ui/             # shadcn/ui primitives (Button, Dialog, etc.)
  features/       # Domain-specific components (tables, forms, dashboards)
  layouts/        # Sidebar, nav, page headers
  providers/      # React context providers (auth, query, theme)

prisma/
  schema.prisma   # Database schema and enums
  actions/        # Server Actions — one file per domain
  data/           # Server-side data-fetching queries — one file per domain
  migrations/     # Auto-generated migration SQL
  seed.ts         # Demo data seed script

lib/
  types.ts        # Shared TypeScript types
  constants.ts    # Shared constants
  utils.ts        # Utility helpers
  auth/           # Auth helpers (server.ts, client.ts)
  prisma.ts       # Prisma client singleton

tests/
  unit/           # Vitest unit project — pure functions, no database
  db/             # Vitest db project — real Postgres, real guards
  stubs/          # Alias targets for the db project (auth, next/cache, server-only)
  helpers/        # Fixture creation and cleanup
  global-setup.ts # Guards DATABASE_URL, sweeps leftover fixtures

middleware.ts     # Route auth middleware
```

## Contributing

### Branch naming

```
XXX-ticket-name-in-kebab-case
```

where `XXX` is the GitHub issue number.

### Commit style

Subject line: `#XXX imperative lowercase summary` (under 80 characters, no trailing period).

Example: `#203 add readme for contributors`

### Pre-push checks

All four must pass before pushing:

```bash
npm run prettier:check
npm run eslint:check
npm run tsc:check
npm run test
```

Fix formatting with `npm run prettier:fix`; fix lint issues in code (never with `eslint-disable` comments). If Postgres isn't available locally, run `npm run test:unit` instead and rely on CI for the full suite.

### Issue tracking

Issues are tracked in [GitHub Issues](https://github.com/SGAOperations/aplio/issues). Assign yourself before starting: `gh issue edit XXX --add-assignee "@me"`.

## Further docs

| Document                                               | Contents                                                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| [`CLAUDE.md`](CLAUDE.md)                               | AI-agent conventions, architecture rules, commit/PR format                                       |
| [`docs/ENGINEERING.md`](docs/ENGINEERING.md)           | Full quality bar: architecture, security, UX states, a11y, performance, Next.js 16 runtime notes |
| [`docs/DESIGN.md`](docs/DESIGN.md)                     | Design system: tokens, type scale, component conventions                                         |
| [`docs/WORKFLOWS.md`](docs/WORKFLOWS.md)               | What each user flow does end to end, per persona                                                 |
| [`docs/PERMISSIONS.md`](docs/PERMISSIONS.md)           | Who may do what, and when: principals, route/action gates, state tables                          |
| [`.claude/docs/PIPELINE.md`](.claude/docs/PIPELINE.md) | Automated agent pipeline and GitHub label state machine                                          |
