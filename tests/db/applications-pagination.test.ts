import {
  cleanupFixtures,
  createTestApplication,
  createTestPosition,
  createTestUser,
} from '@/tests/helpers/fixtures';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Application, Position, User } from '@/prisma/client';
import {
  getApplications,
  getApplicationsCount,
} from '@/prisma/data/applications';

import { APPLICATIONS_PAGE_SIZE } from '@/lib/constants';

// One page and a partial second page, all tied on status and submittedAt —
// only the { id: 'desc' } tiebreaker can order (or page) them consistently.
const APPLICATION_COUNT = APPLICATIONS_PAGE_SIZE + 5;

let admin: User;
let manager: User;
let position: Position;
let otherPosition: Position;
let applications: Application[];

beforeAll(async () => {
  admin = await createTestUser({ isAdmin: true });
  manager = await createTestUser();
  position = await createTestPosition(admin, { managers: [manager] });
  otherPosition = await createTestPosition(admin);

  const submittedAt = new Date('2026-01-01T00:00:00Z');
  const applicants = await Promise.all(
    Array.from({ length: APPLICATION_COUNT }, () => createTestUser()),
  );
  applications = await Promise.all(
    applicants.map((applicant) =>
      createTestApplication(applicant, position, {
        status: 'applied',
        submittedAt,
      }),
    ),
  );

  // Out of scope — must never appear in manager's rows or count.
  const outOfScopeApplicant = await createTestUser();
  await createTestApplication(outOfScopeApplicant, otherPosition, {
    status: 'applied',
  });
});

afterAll(async () => {
  await cleanupFixtures();
});

describe('getApplications / getApplicationsCount pagination', () => {
  it('agrees on total with a query built from the same where', async () => {
    const total = await getApplicationsCount(manager, {});
    expect(total).toBe(APPLICATION_COUNT);
  });

  it('never counts or lists an out-of-scope application', async () => {
    const total = await getApplicationsCount(manager, {});
    expect(total).toBe(APPLICATION_COUNT);

    const page1 = await getApplications(manager, {}, 1);
    const outOfScopeIds = page1.filter(
      (row) => row.position.id === otherPosition.id,
    );
    expect(outOfScopeIds).toHaveLength(0);
  });

  it('slices every page with no duplicates and no gaps', async () => {
    const total = await getApplicationsCount(manager, {});
    const totalPages = Math.ceil(total / APPLICATIONS_PAGE_SIZE);
    expect(totalPages).toBe(2);

    const seen = new Set<string>();
    for (let page = 1; page <= totalPages; page++) {
      const rows = await getApplications(manager, {}, page);
      const expectedLength =
        page < totalPages
          ? APPLICATIONS_PAGE_SIZE
          : total - APPLICATIONS_PAGE_SIZE;
      expect(rows).toHaveLength(expectedLength);
      for (const row of rows) {
        expect(seen.has(row.id)).toBe(false);
        seen.add(row.id);
      }
    }

    expect(seen.size).toBe(total);
  });

  it('returns an empty page past the last page', async () => {
    const rows = await getApplications(manager, {}, 3);
    expect(rows).toEqual([]);
  });

  it('keeps a stable order across pages when everything ties on status', async () => {
    // uuid(7) ids are time-ordered, so lexicographic order matches insertion order.
    const expectedIdsDesc = [...applications]
      .map((a) => a.id)
      .sort()
      .reverse();

    const page1 = await getApplications(manager, {
      sort: { field: 'status', direction: 'asc' },
    });
    const page2 = await getApplications(
      manager,
      { sort: { field: 'status', direction: 'asc' } },
      2,
    );

    expect([...page1, ...page2].map((a) => a.id)).toEqual(expectedIdsDesc);
  });
});
