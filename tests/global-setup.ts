// DB tests write to whatever DATABASE_URL points at — refuse anything that
// isn't obviously local before a single query runs. The fixtures import is
// dynamic: it pulls in lib/prisma.ts, which constructs a client (and throws)
// at import time, so a static import would fire before this guard can.
export default async function setup(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error(
      'DATABASE_URL is not set. Start Postgres with npm run db:start and set DATABASE_URL in .env.',
    );

  const host = new URL(databaseUrl).hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  if (!isLocal && process.env.ALLOW_REMOTE_TEST_DB !== '1')
    throw new Error(
      `DATABASE_URL points at "${host}", not localhost. Refusing to run DB tests against a remote database. Set ALLOW_REMOTE_TEST_DB=1 to override.`,
    );

  // Sweeps leftover fixtures from a crashed previous run.
  const { cleanupFixtures } = await import('@/tests/helpers/fixtures');
  await cleanupFixtures();
}
