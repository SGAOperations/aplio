// Fixtures import is dynamic: a static import would construct the Prisma
// client (lib/prisma.ts) before this local-DB guard can run.
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
