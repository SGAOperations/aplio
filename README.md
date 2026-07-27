# Aplio

Aplio is an internal recruiting and application platform. Admins and managers create **positions** with custom **questions**; applicants build a profile and submit **applications**; managers move applications through a review pipeline (`draft → applied → reached_out → interview_scheduled → reviewing → accepted / rejected / withdrawn`). The platform is designed for operational teams that need structured, configurable hiring workflows without the overhead of general-purpose ATS products.

## Tech stack

| Layer          | Technology                                         |
| -------------- | -------------------------------------------------- |
| Framework      | Next.js 16 (App Router, React 19, Turbopack)       |
| Database / ORM | Prisma 7 (`@prisma/adapter-pg`) · Neon Postgres    |
| Auth           | Stack Auth via `@neondatabase/auth`                |
| Styling        | Tailwind CSS 4 · shadcn/ui (Radix, new-york style) |
| Language       | TypeScript (strict)                                |
| Validation     | zod 4 · react-hook-form                            |
| Notifications  | sonner                                             |

## Getting started

### Prerequisites

- **Node.js** 22+ LTS (see `@types/node` in `package.json`)
- **npm** (comes with Node)
- **Docker** (for a local Postgres instance via `docker-compose.yml`) **or** a hosted Neon Postgres URL

### 1. Environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in the four required variables:

| Variable                    | Description                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`              | Postgres connection string (pooled). Local Docker: `postgresql://admin:admin@localhost:5432/aplio`                  |
| `DIRECT_URL`                | Direct (non-pooled) connection string. Local Docker: same as `DATABASE_URL`                                         |
| `NEON_AUTH_BASE_URL`        | Stack Auth base URL from your Neon Auth project                                                                     |
| `NEON_AUTH_COOKIE_SECRET`   | Stack Auth cookie secret                                                                                            |
| `RESEND_API_KEY`            | Resend API key for transactional email delivery                                                                     |
| `RESEND_FROM_EMAIL`         | Verified sender address in Resend (e.g. `noreply@yourdomain.com`)                                                   |
| `SKIP_WEBHOOK_VERIFICATION` | Set to `true` to bypass Ed25519 webhook signature verification in local development. Must not be set in production. |

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
| `prettier:fix`    | Format all files with Prettier                           |
| `prettier:check`  | Check formatting (used in CI)                            |
| `eslint:check`    | Lint with zero warnings allowed (used in CI)             |
| `eslint:fix`      | Auto-fix lint issues                                     |
| `tsc:check`       | Type-check without emitting (used in CI)                 |

> Always run Prisma through `npm run prisma:*` — never `npx prisma` directly.

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

All three must pass before pushing:

```bash
npm run prettier:check
npm run eslint:check
npm run tsc:check
```

Fix formatting with `npm run prettier:fix`; fix lint issues in code (never with `eslint-disable` comments).

### Issue tracking

Issues are tracked in [GitHub Issues](https://github.com/SGAOperations/aplio/issues). Assign yourself before starting: `gh issue edit XXX --add-assignee "@me"`.

## Further docs

| Document                                                       | Contents                                                               |
| -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [`CLAUDE.md`](CLAUDE.md)                                       | AI-agent conventions, architecture rules, commit/PR format             |
| [`.claude/docs/ENGINEERING.md`](.claude/docs/ENGINEERING.md)   | Full quality bar: architecture, security, UX states, a11y, performance |
| [`.claude/docs/DESIGN.md`](.claude/docs/DESIGN.md)             | Design system: tokens, type scale, component conventions               |
| [`.claude/docs/PIPELINE.md`](.claude/docs/PIPELINE.md)         | Automated agent pipeline and GitHub label state machine                |
| [`.claude/docs/nextjs-notes.md`](.claude/docs/nextjs-notes.md) | Current Next.js 16 App Router behavior — trust over training data      |
