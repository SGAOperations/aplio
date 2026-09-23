import {
  cleanupFixtures,
  createTestApplication,
  createTestPosition,
  createTestUser,
} from '@/tests/helpers/fixtures';
import { actAs } from '@/tests/stubs/auth-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createDraftApplication,
  submitApplication,
  withdrawApplication,
} from '@/prisma/actions/applications';
import type { Position, User } from '@/prisma/client';
import { getApplications, getMyApplications } from '@/prisma/data/applications';

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

describe('Application.submittedAt', () => {
  it('is null on a newly created draft', async () => {
    const applicant = await createTestUser();
    actAs(applicant);

    const result = await createDraftApplication({
      positionId: openPosition.id,
    });
    expect(isError(result)).toBe(false);

    const [application] = await getMyApplications(applicant.id);
    expect(application?.submittedAt).toBeNull();
  });

  it('is set once submitApplication succeeds', async () => {
    const applicant = await createTestUser();
    const draft = await createTestApplication(applicant, openPosition, {
      status: 'draft',
    });

    actAs(applicant);
    const result = await submitApplication(draft.id);
    expect(result).toBeUndefined();

    const [application] = await getMyApplications(applicant.id);
    expect(application?.submittedAt).not.toBeNull();
  });

  it('is preserved (not blanked) when the application is withdrawn', async () => {
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, openPosition, {
      status: 'applied',
    });

    actAs(applicant);
    const result = await withdrawApplication(application.id);
    expect(isError(result)).toBe(false);

    const [row] = await getMyApplications(applicant.id);
    expect(row?.status).toBe('withdrawn');
    expect(row?.submittedAt).toEqual(application.submittedAt);
  });

  it('sorts a null-submittedAt draft ahead of submitted rows in getMyApplications', async () => {
    const applicant = await createTestUser();
    const submitted = await createTestApplication(applicant, openPosition, {
      status: 'applied',
    });
    const secondPosition = await createTestPosition(admin);
    const draft = await createTestApplication(applicant, secondPosition, {
      status: 'draft',
    });

    const rows = await getMyApplications(applicant.id);
    const ids = rows.map((r) => r.id);
    expect(ids.indexOf(draft.id)).toBeLessThan(ids.indexOf(submitted.id));
  });

  it('excludes drafts from a date-range search on the reviewer queue', async () => {
    const manager = await createTestUser();
    const position = await createTestPosition(admin, { managers: [manager] });

    const submittedYear = 2019;
    const submitted = await createTestApplication(
      await createTestUser(),
      position,
      { status: 'applied', submittedAt: new Date(submittedYear, 5, 1) },
    );
    const draft = await createTestApplication(
      await createTestUser(),
      position,
      { status: 'draft' },
    );

    const rows = await getApplications(manager, { q: String(submittedYear) });
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(submitted.id);
    expect(ids).not.toContain(draft.id);
  });
});
