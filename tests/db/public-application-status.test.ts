import {
  cleanupFixtures,
  createTestApplication,
  createTestPosition,
  createTestUser,
} from '@/tests/helpers/fixtures';
import { actAs } from '@/tests/stubs/auth-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadApplicationStatusHistory } from '@/prisma/actions/applications';
import type { Position, User } from '@/prisma/client';
import {
  getApplicationForApply,
  getMyApplication,
  getMyApplicationStatusCounts,
  getMyApplications,
} from '@/prisma/data/applications';

import { isError } from '@/lib/utils';

let admin: User;
let openPosition: Position;

beforeAll(async () => {
  admin = await createTestUser({ isAdmin: true });
  openPosition = await createTestPosition(admin);
});

afterAll(async () => {
  await cleanupFixtures();
});

const IN_GROUP_STATUSES = [
  'reached_out',
  'interview_scheduled',
  'reviewing',
] as const;

describe('applicant-scoped queries collapse in-group statuses', () => {
  for (const status of IN_GROUP_STATUSES) {
    it(`getMyApplications reports '${status}' as 'applied'`, async () => {
      const applicant = await createTestUser();
      await createTestApplication(applicant, openPosition, { status });

      const applications = await getMyApplications(applicant.id);
      expect(applications).toHaveLength(1);
      expect(applications[0]?.status).toBe('applied');
    });

    it(`getMyApplication reports '${status}' as 'applied'`, async () => {
      const applicant = await createTestUser();
      const application = await createTestApplication(applicant, openPosition, {
        status,
      });

      const detail = await getMyApplication(application.id, applicant.id);
      expect(detail?.status).toBe('applied');
    });

    it(`getApplicationForApply reports '${status}' as 'applied'`, async () => {
      const applicant = await createTestUser();
      await createTestApplication(applicant, openPosition, { status });

      const draft = await getApplicationForApply(applicant.id, openPosition.id);
      expect(draft?.status).toBe('applied');
    });
  }

  it('draft, accepted, rejected and withdrawn all map to themselves', async () => {
    for (const status of [
      'draft',
      'accepted',
      'rejected',
      'withdrawn',
    ] as const) {
      const applicant = await createTestUser();
      const application = await createTestApplication(applicant, openPosition, {
        status,
      });

      const detail = await getMyApplication(application.id, applicant.id);
      expect(detail?.status).toBe(status);
    }
  });

  it('getMyApplicationStatusCounts aggregates in-group counts into "applied"', async () => {
    const applicant = await createTestUser();
    const secondPosition = await createTestPosition(admin);
    await createTestApplication(applicant, openPosition, {
      status: 'reached_out',
    });
    await createTestApplication(applicant, secondPosition, {
      status: 'reviewing',
    });

    const counts = await getMyApplicationStatusCounts(applicant.id);
    expect(counts.applied).toBe(2);
    expect(Object.keys(counts)).toEqual(['applied']);
  });

  it('a submitted application carries no lastSavedAt', async () => {
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, openPosition, {
      status: 'reviewing',
    });

    const detail = await getMyApplication(application.id, applicant.id);
    expect(detail?.lastSavedAt).toBeNull();
  });

  it('a draft carries its updatedAt as lastSavedAt', async () => {
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, openPosition, {
      status: 'draft',
    });

    const detail = await getMyApplication(application.id, applicant.id);
    expect(detail?.lastSavedAt).toEqual(application.updatedAt);
  });
});

describe('loadApplicationStatusHistory scope', () => {
  it('enforces the listable scope — a non-owning manager gets no rows, not a throw', async () => {
    const owningManager = await createTestUser({ isAdmin: false });
    const otherManager = await createTestUser({ isAdmin: false });
    const position = await createTestPosition(owningManager, {
      managers: [owningManager],
    });
    // otherManager must manage *something* to pass requireManagerOrAdmin —
    // the point is they aren't in scope for `position` specifically.
    await createTestPosition(otherManager, { managers: [otherManager] });
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, position, {
      status: 'applied',
    });

    actAs(otherManager);
    const result = await loadApplicationStatusHistory({
      applicationId: application.id,
    });
    expect(isError(result)).toBe(false);
    expect(result).toEqual([]);
  });

  it('returns Invalid input for a malformed id', async () => {
    actAs(admin);
    const result = await loadApplicationStatusHistory({ applicationId: '' });
    expect(result).toEqual({ error: 'Invalid input' });
  });
});
