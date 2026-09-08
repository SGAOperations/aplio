import {
  cleanupFixtures,
  createTestApplication,
  createTestPosition,
  createTestUser,
} from '@/tests/helpers/fixtures';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Application, Position, User } from '@/prisma/client';
import {
  getApplicationForReview,
  getDraftApplications,
  getDraftApplicationsCount,
} from '@/prisma/data/applications';

let admin: User;
let managerA: User;
let managerB: User;

let positionA: Position;
let positionB: Position;
let draftPosition: Position;
let deletedPosition: Position;

let draftApplicantA: User;
let draftApplicationA: Application;
let submittedApplicationA: Application;
let deletedDraftApplicantA: User;

beforeAll(async () => {
  admin = await createTestUser({ isAdmin: true });
  managerA = await createTestUser();
  managerB = await createTestUser();

  positionA = await createTestPosition(admin, { managers: [managerA] });
  positionB = await createTestPosition(admin, { managers: [managerB] });
  draftPosition = await createTestPosition(admin, {
    managers: [managerA],
    status: 'draft',
  });
  deletedPosition = await createTestPosition(admin, {
    managers: [managerA],
    deletedAt: new Date(),
  });

  draftApplicantA = await createTestUser();
  draftApplicationA = await createTestApplication(draftApplicantA, positionA, {
    status: 'draft',
  });

  const submittedApplicant = await createTestUser();
  submittedApplicationA = await createTestApplication(
    submittedApplicant,
    positionA,
    { status: 'applied' },
  );

  deletedDraftApplicantA = await createTestUser();
  await createTestApplication(deletedDraftApplicantA, positionA, {
    status: 'draft',
    deletedAt: new Date(),
  });

  const draftApplicantB = await createTestUser();
  await createTestApplication(draftApplicantB, positionB, { status: 'draft' });

  const draftPositionApplicant = await createTestUser();
  await createTestApplication(draftPositionApplicant, draftPosition, {
    status: 'draft',
  });

  const deletedPositionApplicant = await createTestUser();
  await createTestApplication(deletedPositionApplicant, deletedPosition, {
    status: 'draft',
  });
});

afterAll(async () => {
  await cleanupFixtures();
});

describe('getDraftApplications / getDraftApplicationsCount', () => {
  it('returns drafts only for positions the manager manages', async () => {
    const rows = await getDraftApplications(managerA, {});
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(draftApplicationA.id);

    const otherManagerRow = await getDraftApplications(managerB, {});
    expect(otherManagerRow.map((r) => r.id)).not.toContain(
      draftApplicationA.id,
    );
  });

  it('gives an unrelated manager no drafts at all', async () => {
    const unrelatedManager = await createTestUser();
    const rows = await getDraftApplications(unrelatedManager, {});
    expect(rows).toEqual([]);
    expect(await getDraftApplicationsCount(unrelatedManager, {})).toBe(0);
  });

  it('shows an admin drafts across all published positions', async () => {
    const rows = await getDraftApplications(admin, {});
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(draftApplicationA.id);
    const managerBRows = await getDraftApplications(managerB, {});
    expect(ids).toEqual(expect.arrayContaining(managerBRows.map((r) => r.id)));
  });

  it('excludes a soft-deleted draft', async () => {
    const asManagerA = (await getDraftApplications(managerA, {})).map(
      (r) => r.user.id,
    );
    expect(asManagerA).not.toContain(deletedDraftApplicantA.id);

    const asAdmin = (await getDraftApplications(admin, {})).map(
      (r) => r.user.id,
    );
    expect(asAdmin).not.toContain(deletedDraftApplicantA.id);
  });

  it('excludes drafts on an unpublished (draft-status) or soft-deleted position', async () => {
    const asManagerA = (await getDraftApplications(managerA, {})).map(
      (r) => r.position.id,
    );
    expect(asManagerA).not.toContain(draftPosition.id);
    expect(asManagerA).not.toContain(deletedPosition.id);

    const asAdmin = (await getDraftApplications(admin, {})).map(
      (r) => r.position.id,
    );
    expect(asAdmin).not.toContain(draftPosition.id);
    expect(asAdmin).not.toContain(deletedPosition.id);
  });

  it('never returns a non-draft application', async () => {
    const rows = await getDraftApplications(managerA, {});
    expect(rows.map((r) => r.id)).not.toContain(submittedApplicationA.id);
  });

  it('agrees on total with the rows returned', async () => {
    const total = await getDraftApplicationsCount(managerA, {});
    const rows = await getDraftApplications(managerA, {});
    expect(total).toBe(rows.length);
  });

  it('selects no answer, file, status, or applicantName field', async () => {
    const rows = await getDraftApplications(managerA, {});
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).not.toHaveProperty('globalAnswers');
      expect(row).not.toHaveProperty('positionAnswers');
      expect(row).not.toHaveProperty('applicantName');
      expect(row).not.toHaveProperty('status');
    }
  });

  it('still 404s (returns null) for getApplicationForReview on a draft', async () => {
    expect(
      await getApplicationForReview(draftApplicationA.id, managerA),
    ).toBeNull();
    expect(
      await getApplicationForReview(draftApplicationA.id, admin),
    ).toBeNull();
  });

  it('shows a blank-named applicant by email', async () => {
    const blankNameApplicant = await createTestUser({ name: '' });
    const blankNameDraft = await createTestApplication(
      blankNameApplicant,
      positionA,
      { status: 'draft' },
    );

    const rows = await getDraftApplications(managerA, {});
    const row = rows.find((r) => r.id === blankNameDraft.id);
    expect(row?.user.email).toBe(blankNameApplicant.email);
  });
});
