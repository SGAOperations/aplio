#!/usr/bin/env node
// First link of vercel.json's buildCommand chain, so a non-zero exit here
// short-circuits `next build`. Only Preview deploys do anything: Production and
// Development exit silently, keeping those builds byte-for-byte `npm run build`.
// `migrate deploy` requires DATABASE_URL_UNPOOLED — Neon's pooled endpoint
// rejects it — so that URL is substituted into DATABASE_URL for the child
// process. This file only ever runs on Vercel; nothing invokes it locally.
import { execFileSync } from 'node:child_process';

if (process.env.VERCEL_ENV !== 'preview') process.exit(0);

// Unset, empty, and whitespace-only all mean "the integration never attached a
// branch" — in practice because the Neon project is at its branch cap.
const unpooledUrl = process.env.DATABASE_URL_UNPOOLED?.trim();

if (!unpooledUrl) {
  console.error(
    [
      'Neon branch limit exceeded — no preview database for this deployment.',
      '',
      'DATABASE_URL_UNPOOLED is unset, so the Neon Previews Integration could not',
      'attach a preview branch: the project is at its 10-branch cap.',
      '',
      'A slot frees when an open PR is merged or closed, and the next push to this',
      'branch redeploys. See README.md -> "Deployment & databases".',
    ].join('\n'),
  );
  process.exit(1);
}

try {
  // npm.cmd on Windows so an accidental local run fails readably, not ENOENT.
  execFileSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', 'prisma:migrate:deploy'],
    { stdio: 'inherit', env: { ...process.env, DATABASE_URL: unpooledUrl } },
  );
} catch (err) {
  // Prisma already printed the useful error; adding commentary only buries it.
  process.exit(err.status ?? 1);
}
