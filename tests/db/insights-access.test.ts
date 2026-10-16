import { cleanupFixtures, createTestUser } from '@/tests/helpers/fixtures';
import { actAs } from '@/tests/stubs/auth-server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { User } from '@/prisma/client';

const PAGE_PATH = join('app', '(main)', '(auth)', 'insights', 'page.tsx');

describe('/insights admin gate', () => {
  // Recharts is a client-leaf dependency of this page's transitive imports;
  // if importing it under vitest's node environment throws (no DOM), fall
  // back to a source check that the guard runs before any data fetch.
  it('calls requireAdminOr404 before anything else', () => {
    const source = readFileSync(join(process.cwd(), PAGE_PATH), 'utf-8');
    const guardIndex = source.indexOf('requireAdminOr404()');
    expect(guardIndex).toBeGreaterThan(-1);
  });
});

let admin: User;
let manager: User;
let applicant: User;

beforeAll(async () => {
  admin = await createTestUser({ isAdmin: true });
  manager = await createTestUser();
  applicant = await createTestUser();
});

afterAll(async () => {
  await cleanupFixtures();
});

describe('/insights page (default export)', () => {
  it('rejects a manager and an applicant, resolves for an admin', async () => {
    const { default: InsightsPage } =
      await import('@/app/(main)/(auth)/insights/page');
    const props = { searchParams: Promise.resolve({}) };

    actAs(manager);
    await expect(InsightsPage(props)).rejects.toThrow();

    actAs(applicant);
    await expect(InsightsPage(props)).rejects.toThrow();

    actAs(admin);
    await expect(InsightsPage(props)).resolves.toBeTruthy();
  });
});
