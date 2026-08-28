import {
  cleanupFixtures,
  createTestApplication,
  createTestGlobalQuestion,
  createTestPosition,
  createTestPositionQuestion,
  createTestSession,
  createTestUser,
} from '@/tests/helpers/fixtures';
import { actAs } from '@/tests/stubs/auth-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createOrUpdateApplicationAnswer,
  updateApplicationStatus,
  updateApplicationStatuses,
} from '@/prisma/actions/applications';
import {
  createGlobalQuestion,
  deleteGlobalQuestion,
  updateGlobalQuestion,
} from '@/prisma/actions/global-questions';
import { searchUsers } from '@/prisma/actions/position-actions';
import {
  createPositionQuestion,
  deletePositionQuestion,
  updatePositionQuestion,
} from '@/prisma/actions/position-question-actions';
import {
  createUser,
  deactivateUser,
  toggleUserAdmin,
} from '@/prisma/actions/users';
import type { Application, Position, User } from '@/prisma/client';
import {
  getApplicationForApply,
  getApplicationForReview,
  getApplicationStatusCounts,
  getApplications,
  getApplicationsCount,
  getMyApplications,
  getMyApplicationsByPosition,
  getMySubmittedCount,
  getRecentApplications,
  getReviewableApplicants,
  getReviewablePositions,
} from '@/prisma/data/applications';
import { checkPositionAccess, isManager } from '@/prisma/data/managers';
import { getManagedPositions } from '@/prisma/data/positions';
import { getUsersForAdmin } from '@/prisma/data/users';

import {
  requireAdmin,
  requireAdminOr404,
  requireManagerOrAdmin,
  requireOwnership,
  requirePositionAccess,
} from '@/lib/auth/guards';
import { prisma } from '@/lib/prisma';
import { isError } from '@/lib/utils';

let admin: User;
let managerA: User;
let managerB: User;
let applicant: User;
let positionA: Position;
let positionB: Position;
let draftPosition: Position;
let deletedPosition: Position;

let applicantAppliedA: User;
let applicantDraftA: User;
let applicantWithdrawnA: User;
let applicantAppliedB: User;

let applicationA1: Application;
let draftApplicationA: Application;
let withdrawnApplicationA: Application;
let applicationB1: Application;

beforeAll(async () => {
  admin = await createTestUser({ isAdmin: true });
  managerA = await createTestUser();
  managerB = await createTestUser();
  applicant = await createTestUser();

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

  applicantAppliedA = await createTestUser();
  applicantDraftA = await createTestUser();
  applicantWithdrawnA = await createTestUser();
  applicantAppliedB = await createTestUser();

  applicationA1 = await createTestApplication(applicantAppliedA, positionA, {
    status: 'applied',
  });
  draftApplicationA = await createTestApplication(applicantDraftA, positionA, {
    status: 'draft',
  });
  withdrawnApplicationA = await createTestApplication(
    applicantWithdrawnA,
    positionA,
    { status: 'withdrawn' },
  );
  applicationB1 = await createTestApplication(applicantAppliedB, positionB, {
    status: 'applied',
  });
});

afterAll(async () => {
  await cleanupFixtures();
});

describe('requireAdmin / requireAdminOr404', () => {
  it('rejects a manager', async () => {
    actAs(managerA);
    await expect(requireAdmin()).rejects.toThrow();
    await expect(requireAdminOr404()).rejects.toThrow();
  });

  it('rejects an applicant', async () => {
    actAs(applicant);
    await expect(requireAdmin()).rejects.toThrow();
    await expect(requireAdminOr404()).rejects.toThrow();
  });

  it('resolves for an admin', async () => {
    actAs(admin);
    await expect(requireAdmin()).resolves.toMatchObject({ id: admin.id });
  });
});

describe('requireManagerOrAdmin', () => {
  it('rejects an applicant', async () => {
    actAs(applicant);
    await expect(requireManagerOrAdmin()).rejects.toThrow();
  });

  it('rejects a manager whose only position is soft-deleted', async () => {
    const onlyDeletedManager = await createTestUser();
    await createTestPosition(admin, {
      managers: [onlyDeletedManager],
      deletedAt: new Date(),
    });
    actAs(onlyDeletedManager);
    await expect(requireManagerOrAdmin()).rejects.toThrow();
  });

  it('resolves for a manager of a live position', async () => {
    actAs(managerA);
    await expect(requireManagerOrAdmin()).resolves.toMatchObject({
      id: managerA.id,
    });
  });
});

describe('requirePositionAccess', () => {
  it('rejects a manager of a different position', async () => {
    actAs(managerA);
    await expect(requirePositionAccess(positionB.id)).rejects.toThrow();
  });

  it('resolves for an admin on any position', async () => {
    actAs(admin);
    await expect(requirePositionAccess(positionB.id)).resolves.toMatchObject({
      id: admin.id,
    });
  });
});

describe('requireOwnership', () => {
  it("throws for another user's record", () => {
    expect(() =>
      requireOwnership({ userId: 'someone-else' }, applicant.id),
    ).toThrow();
  });

  it('throws for a null record', () => {
    expect(() => requireOwnership(null, applicant.id)).toThrow();
  });
});

describe('searchUsers (#357)', () => {
  it('rejects a plain applicant', async () => {
    actAs(applicant);
    await expect(searchUsers({ query: 'a' })).rejects.toThrow();
  });

  it('resolves for a manager and withholds id', async () => {
    const target = await createTestUser();
    actAs(managerA);
    const result = await searchUsers({ query: target.email });
    if (isError(result)) throw new Error('expected a result array');
    expect(result.some((row) => row.primaryEmail === target.email)).toBe(true);
    for (const row of result) expect(row).not.toHaveProperty('id');
  });
});

describe('getApplications / getApplicationsCount / getApplicationForReview / getReviewablePositions / getReviewableApplicants', () => {
  it('scopes getApplications to the managing manager, admin sees both, draft/deleted excluded, withdrawn included', async () => {
    const asManagerA = await getApplications(managerA, {});
    const idsA = asManagerA.map((a) => a.id);
    expect(idsA).toContain(applicationA1.id);
    expect(idsA).toContain(withdrawnApplicationA.id);
    expect(idsA).not.toContain(applicationB1.id);
    expect(idsA).not.toContain(draftApplicationA.id);

    const asManagerB = await getApplications(managerB, {});
    const idsB = asManagerB.map((a) => a.id);
    expect(idsB).toContain(applicationB1.id);
    expect(idsB).not.toContain(applicationA1.id);

    const asAdmin = await getApplications(admin, {});
    const idsAdmin = asAdmin.map((a) => a.id);
    expect(idsAdmin).toContain(applicationA1.id);
    expect(idsAdmin).toContain(applicationB1.id);
    expect(idsAdmin).not.toContain(draftApplicationA.id);
  });

  it('excludes applications on draft and soft-deleted positions for both manager and admin', async () => {
    const draftPositionApplicant = await createTestUser();
    const onDraftPosition = await createTestApplication(
      draftPositionApplicant,
      draftPosition,
      { status: 'applied' },
    );
    const deletedPositionApplicant = await createTestUser();
    const onDeletedPosition = await createTestApplication(
      deletedPositionApplicant,
      deletedPosition,
      { status: 'applied' },
    );

    const asManagerA = (await getApplications(managerA, {})).map((a) => a.id);
    expect(asManagerA).not.toContain(onDraftPosition.id);
    expect(asManagerA).not.toContain(onDeletedPosition.id);

    const asAdmin = (await getApplications(admin, {})).map((a) => a.id);
    expect(asAdmin).not.toContain(onDraftPosition.id);
    expect(asAdmin).not.toContain(onDeletedPosition.id);
  });

  it('never counts an out-of-scope application towards the total', async () => {
    const before = await getApplicationsCount(managerA, {});
    const extraApplicant = await createTestUser();
    await createTestApplication(extraApplicant, positionB, {
      status: 'applied',
    });
    const after = await getApplicationsCount(managerA, {});
    expect(after).toBe(before);
  });

  it('counts an in-scope application towards the total', async () => {
    const before = await getApplicationsCount(managerA, {});
    const extraApplicant = await createTestUser();
    await createTestApplication(extraApplicant, positionA, {
      status: 'applied',
    });
    const after = await getApplicationsCount(managerA, {});
    expect(after).toBe(before + 1);
  });

  it('returns null for getApplicationForReview outside the caller scope', async () => {
    expect(
      await getApplicationForReview(applicationB1.id, managerA),
    ).toBeNull();
  });

  it('returns the application for getApplicationForReview inside scope', async () => {
    const result = await getApplicationForReview(applicationA1.id, managerA);
    expect(result?.id).toBe(applicationA1.id);
    expect(
      await getApplicationForReview(applicationA1.id, admin),
    ).toMatchObject({ id: applicationA1.id });
  });

  it('scopes getReviewablePositions to the managing manager, admin sees both', async () => {
    const asManagerA = (await getReviewablePositions(managerA)).map(
      (p) => p.id,
    );
    expect(asManagerA).toContain(positionA.id);
    expect(asManagerA).not.toContain(positionB.id);
    expect(asManagerA).not.toContain(draftPosition.id);
    expect(asManagerA).not.toContain(deletedPosition.id);

    const asAdmin = (await getReviewablePositions(admin)).map((p) => p.id);
    expect(asAdmin).toContain(positionA.id);
    expect(asAdmin).toContain(positionB.id);
    expect(asAdmin).not.toContain(draftPosition.id);
    expect(asAdmin).not.toContain(deletedPosition.id);
  });

  it('scopes getReviewableApplicants to the managing manager, admin sees both, draft-only excluded, withdrawn-only included', async () => {
    const asManagerA = (await getReviewableApplicants(managerA)).map(
      (a) => a.id,
    );
    expect(asManagerA).toContain(applicantAppliedA.id);
    expect(asManagerA).toContain(applicantWithdrawnA.id);
    expect(asManagerA).not.toContain(applicantDraftA.id);
    expect(asManagerA).not.toContain(applicantAppliedB.id);

    const asManagerB = (await getReviewableApplicants(managerB)).map(
      (a) => a.id,
    );
    expect(asManagerB).toContain(applicantAppliedB.id);
    expect(asManagerB).not.toContain(applicantAppliedA.id);

    const asAdmin = (await getReviewableApplicants(admin)).map((a) => a.id);
    expect(asAdmin).toContain(applicantAppliedA.id);
    expect(asAdmin).toContain(applicantAppliedB.id);
    expect(asAdmin).not.toContain(applicantDraftA.id);
  });

  it('excludes an applicant whose only application is on a draft or soft-deleted position', async () => {
    const draftPositionApplicant = await createTestUser();
    await createTestApplication(draftPositionApplicant, draftPosition, {
      status: 'applied',
    });
    const deletedPositionApplicant = await createTestUser();
    await createTestApplication(deletedPositionApplicant, deletedPosition, {
      status: 'applied',
    });

    const asManagerA = (await getReviewableApplicants(managerA)).map(
      (a) => a.id,
    );
    expect(asManagerA).not.toContain(draftPositionApplicant.id);
    expect(asManagerA).not.toContain(deletedPositionApplicant.id);

    const asAdmin = (await getReviewableApplicants(admin)).map((a) => a.id);
    expect(asAdmin).not.toContain(draftPositionApplicant.id);
    expect(asAdmin).not.toContain(deletedPositionApplicant.id);
  });
});

describe('getMyApplications / getApplicationForApply / getMySubmittedCount', () => {
  it("never returns another user's application", async () => {
    const mine = (await getMyApplications(applicantAppliedA.id)).map(
      (a) => a.id,
    );
    expect(mine).toContain(applicationA1.id);
    expect(mine).not.toContain(applicationB1.id);
  });

  it("getApplicationForApply returns the caller's own row, never another's", async () => {
    const own = await getApplicationForApply(
      applicantAppliedA.id,
      positionA.id,
    );
    expect(own?.id).toBe(applicationA1.id);

    const other = await getApplicationForApply(
      applicantDraftA.id,
      positionA.id,
    );
    expect(other?.id).toBe(draftApplicationA.id);
    expect(other?.id).not.toBe(applicationA1.id);
  });

  it("getMySubmittedCount only counts the caller's own non-draft applications", async () => {
    const freshApplicant = await createTestUser();
    expect(await getMySubmittedCount(freshApplicant.id)).toBe(0);

    await createTestApplication(freshApplicant, positionB, { status: 'draft' });
    expect(await getMySubmittedCount(freshApplicant.id)).toBe(0);

    const freshApplicant2 = await createTestUser();
    await createTestApplication(freshApplicant2, positionB, {
      status: 'applied',
    });
    expect(await getMySubmittedCount(freshApplicant2.id)).toBe(1);
  });

  it('getMyApplicationsByPosition scopes to the caller and excludes soft-deleted rows', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    const sharedPosition = await createTestPosition(admin, {
      managers: [managerA],
    });

    const appA = await createTestApplication(userA, sharedPosition, {
      status: 'applied',
    });
    const appB = await createTestApplication(userB, sharedPosition, {
      status: 'draft',
    });

    const otherPosition = await createTestPosition(admin, {
      managers: [managerA],
    });
    await createTestApplication(userA, otherPosition, {
      status: 'draft',
      deletedAt: new Date(),
    });

    const mapA = await getMyApplicationsByPosition(userA.id);
    expect(mapA.get(sharedPosition.id)?.id).toBe(appA.id);
    expect(mapA.has(otherPosition.id)).toBe(false);

    const mapB = await getMyApplicationsByPosition(userB.id);
    expect(mapB.get(sharedPosition.id)?.id).toBe(appB.id);
    expect(mapB.get(sharedPosition.id)?.id).not.toBe(appA.id);
  });
});

describe('getManagedPositions / isManager / checkPositionAccess', () => {
  it('never grants access via or lists a soft-deleted position', async () => {
    const managerOfDeletedOnly = await createTestUser();
    const onlyDeleted = await createTestPosition(admin, {
      managers: [managerOfDeletedOnly],
      deletedAt: new Date(),
    });

    expect(await isManager(managerOfDeletedOnly.id)).toBe(false);
    expect(
      await checkPositionAccess(onlyDeleted.id, managerOfDeletedOnly),
    ).toBe(false);
    const managed = (await getManagedPositions(managerOfDeletedOnly.id)).map(
      (p) => p.id,
    );
    expect(managed).not.toContain(onlyDeleted.id);
  });

  it('grants access via and lists a live managed position', async () => {
    expect(await isManager(managerA.id)).toBe(true);
    expect(await checkPositionAccess(positionA.id, managerA)).toBe(true);
    const managed = (await getManagedPositions(managerA.id)).map((p) => p.id);
    expect(managed).toContain(positionA.id);
  });
});

describe('updateApplicationStatus', () => {
  it('throws for the applicant caller', async () => {
    actAs(applicantAppliedA);
    await expect(
      updateApplicationStatus({
        applicationId: applicationA1.id,
        status: 'reviewing',
      }),
    ).rejects.toThrow('Application not found or not authorized');
  });

  it('throws for a manager who does not manage the position', async () => {
    actAs(managerB);
    await expect(
      updateApplicationStatus({
        applicationId: applicationA1.id,
        status: 'reviewing',
      }),
    ).rejects.toThrow('Application not found or not authorized');
  });

  it('throws for the managing manager when the position is draft or soft-deleted', async () => {
    const draftPositionApplicant = await createTestUser();
    const onDraftPosition = await createTestApplication(
      draftPositionApplicant,
      draftPosition,
      { status: 'applied' },
    );
    const deletedPositionApplicant = await createTestUser();
    const onDeletedPosition = await createTestApplication(
      deletedPositionApplicant,
      deletedPosition,
      { status: 'applied' },
    );

    actAs(managerA);
    await expect(
      updateApplicationStatus({
        applicationId: onDraftPosition.id,
        status: 'reviewing',
      }),
    ).rejects.toThrow('Application not found or not authorized');
    await expect(
      updateApplicationStatus({
        applicationId: onDeletedPosition.id,
        status: 'reviewing',
      }),
    ).rejects.toThrow('Application not found or not authorized');
  });

  it('throws for the managing manager when the application is withdrawn', async () => {
    actAs(managerA);
    await expect(
      updateApplicationStatus({
        applicationId: withdrawnApplicationA.id,
        status: 'reviewing',
      }),
    ).rejects.toThrow('Application not found or not authorized');
  });
});

describe('updateApplicationStatuses', () => {
  it('writes only the in-scope id and reports the count', async () => {
    const inScopeApplicant = await createTestUser();
    const inScopeApp = await createTestApplication(
      inScopeApplicant,
      positionA,
      { status: 'applied' },
    );
    const outScopeApplicant = await createTestUser();
    const outScopeApp = await createTestApplication(
      outScopeApplicant,
      positionB,
      { status: 'applied' },
    );

    actAs(managerA);
    const result = await updateApplicationStatuses({
      applicationIds: [inScopeApp.id, outScopeApp.id],
      status: 'reviewing',
    });
    expect(result).toEqual({ updated: 1, skipped: 1 });

    const updated = await prisma.application.findUniqueOrThrow({
      where: { id: inScopeApp.id },
      select: { status: true },
    });
    expect(updated.status).toBe('reviewing');

    const untouched = await prisma.application.findUniqueOrThrow({
      where: { id: outScopeApp.id },
      select: { status: true },
    });
    expect(untouched.status).toBe('applied');
  });

  it('returns an error when every id is out of scope', async () => {
    actAs(managerA);
    const result = await updateApplicationStatuses({
      applicationIds: [applicationB1.id],
      status: 'reviewing',
    });
    expect(result).toEqual({
      error:
        "None of the selected applications can move to Reviewing — they're already there, or they're drafts or withdrawn.",
    });
  });

  it('skips a withdrawn row while updating the rest', async () => {
    const withdrawnApplicant = await createTestUser();
    const withdrawnApp = await createTestApplication(
      withdrawnApplicant,
      positionA,
      { status: 'withdrawn' },
    );
    const reviewableApplicant = await createTestUser();
    const reviewableApp = await createTestApplication(
      reviewableApplicant,
      positionA,
      { status: 'applied' },
    );

    actAs(managerA);
    const result = await updateApplicationStatuses({
      applicationIds: [withdrawnApp.id, reviewableApp.id],
      status: 'reviewing',
    });
    expect(result).toEqual({ updated: 1, skipped: 1 });

    const stillWithdrawn = await prisma.application.findUniqueOrThrow({
      where: { id: withdrawnApp.id },
      select: { status: true },
    });
    expect(stillWithdrawn.status).toBe('withdrawn');
  });

  it('skips a row on a draft or soft-deleted position', async () => {
    const draftPositionApplicant = await createTestUser();
    const onDraftPosition = await createTestApplication(
      draftPositionApplicant,
      draftPosition,
      { status: 'applied' },
    );
    const deletedPositionApplicant = await createTestUser();
    const onDeletedPosition = await createTestApplication(
      deletedPositionApplicant,
      deletedPosition,
      { status: 'applied' },
    );

    actAs(managerA);
    const result = await updateApplicationStatuses({
      applicationIds: [onDraftPosition.id, onDeletedPosition.id],
      status: 'reviewing',
    });
    expect(result).toEqual({
      error:
        "None of the selected applications can move to Reviewing — they're already there, or they're drafts or withdrawn.",
    });

    const stillDraftPosition = await prisma.application.findUniqueOrThrow({
      where: { id: onDraftPosition.id },
      select: { status: true },
    });
    expect(stillDraftPosition.status).toBe('applied');
  });
});

describe('getApplicationStatusCounts / getRecentApplications listable vs reviewable', () => {
  it('excludes withdrawn from the reviewable pair while getApplications keeps it', async () => {
    const counts = await getApplicationStatusCounts(managerA);
    expect(counts.withdrawn).toBeUndefined();

    const recent = (await getRecentApplications(managerA)).map((a) => a.id);
    expect(recent).not.toContain(withdrawnApplicationA.id);
    expect(recent).toContain(applicationA1.id);

    const listable = (await getApplications(managerA, {})).map((a) => a.id);
    expect(listable).toContain(withdrawnApplicationA.id);
  });

  it('scopes both to the managing manager', async () => {
    const recentAsManagerB = (await getRecentApplications(managerB)).map(
      (a) => a.id,
    );
    expect(recentAsManagerB).not.toContain(applicationA1.id);
    expect(recentAsManagerB).toContain(applicationB1.id);
  });
});

describe('createOrUpdateApplicationAnswer', () => {
  it("throws for another user's application", async () => {
    const owner = await createTestUser();
    const ownerApp = await createTestApplication(owner, positionA, {
      status: 'draft',
    });
    const question = await createTestGlobalQuestion(admin, { required: false });
    const other = await createTestUser();

    actAs(other);
    await expect(
      createOrUpdateApplicationAnswer({
        applicationId: ownerApp.id,
        questionId: question.id,
        value: ['x'],
      }),
    ).rejects.toThrow();
  });
});

describe('toggleUserAdmin / deactivateUser / createUser', () => {
  it('rejects a non-admin caller', async () => {
    const target = await createTestUser();
    actAs(applicant);
    await expect(
      toggleUserAdmin({ userId: target.id, makeAdmin: true }),
    ).rejects.toThrow();
    await expect(deactivateUser({ userId: target.id })).rejects.toThrow();
    await expect(
      createUser({ email: `${target.email}.new`, isAdmin: false }),
    ).rejects.toThrow();
  });

  it('refuses an admin changing their own admin role', async () => {
    actAs(admin);
    const result = await toggleUserAdmin({
      userId: admin.id,
      makeAdmin: false,
    });
    expect(result).toEqual({ error: 'You cannot change your own admin role.' });
  });

  it('refuses an admin deactivating their own account', async () => {
    actAs(admin);
    const result = await deactivateUser({ userId: admin.id });
    expect(result).toEqual({
      error: 'You cannot deactivate your own account.',
    });
  });

  it('revokes a live session and leaves other sessions untouched', async () => {
    const target = await createTestUser();
    const bystander = await createTestUser();
    await createTestSession(target);
    await createTestSession(target);
    const bystanderSession = await createTestSession(bystander);

    actAs(admin);
    const result = await deactivateUser({ userId: target.id });
    expect(result).toBeUndefined();

    const targetRow = await prisma.user.findUniqueOrThrow({
      where: { id: target.id },
    });
    expect(targetRow.deletedAt).not.toBeNull();

    const targetSessions = await prisma.session.findMany({
      where: { userId: target.id },
    });
    expect(targetSessions).toHaveLength(0);

    const bystanderStillExists = await prisma.session.findUnique({
      where: { id: bystanderSession.id },
    });
    expect(bystanderStillExists).not.toBeNull();
  });

  it('succeeds deactivating a user with no session', async () => {
    const target = await createTestUser();
    actAs(admin);
    const result = await deactivateUser({ userId: target.id });
    expect(result).toBeUndefined();

    const targetRow = await prisma.user.findUniqueOrThrow({
      where: { id: target.id },
    });
    expect(targetRow.deletedAt).not.toBeNull();
  });

  it('rejects requireAdmin for a freshly-demoted admin on their next request', async () => {
    const demoted = await createTestUser({ isAdmin: true });

    actAs(admin);
    const result = await toggleUserAdmin({
      userId: demoted.id,
      makeAdmin: false,
    });
    expect(result).toBeUndefined();

    actAs(await prisma.user.findUniqueOrThrow({ where: { id: demoted.id } }));
    await expect(requireAdmin()).rejects.toThrow();
  });
});

describe('deactivated users excluded from admin queries', () => {
  it('never appears in getUsersForAdmin or searchUsers', async () => {
    const target = await createTestUser({
      name: 'Deactivated Target',
      deletedAt: new Date(),
    });

    const adminList = (await getUsersForAdmin()).map((u) => u.id);
    expect(adminList).not.toContain(target.id);

    actAs(admin);
    const searchResult = await searchUsers({ query: target.email });
    if (isError(searchResult)) throw new Error('expected a result array');
    expect(searchResult.some((row) => row.primaryEmail === target.email)).toBe(
      false,
    );
  });
});

describe('createGlobalQuestion / updateGlobalQuestion / deleteGlobalQuestion', () => {
  it('rejects a manager and an applicant', async () => {
    const input = {
      label: 'x',
      type: 'short_answer' as const,
      required: true,
      options: [] as string[],
      allowOther: false,
      format: null,
    };
    actAs(managerA);
    await expect(createGlobalQuestion(input)).rejects.toThrow();
    actAs(applicant);
    await expect(createGlobalQuestion(input)).rejects.toThrow();

    const existing = await createTestGlobalQuestion(admin);
    actAs(managerA);
    await expect(
      updateGlobalQuestion({ id: existing.id, ...input }),
    ).rejects.toThrow();
    await expect(deleteGlobalQuestion({ id: existing.id })).rejects.toThrow();
    actAs(applicant);
    await expect(
      updateGlobalQuestion({ id: existing.id, ...input }),
    ).rejects.toThrow();
    await expect(deleteGlobalQuestion({ id: existing.id })).rejects.toThrow();
  });
});

describe('createPositionQuestion / updatePositionQuestion / deletePositionQuestion', () => {
  it('rejects a manager of another position and an applicant', async () => {
    const input = {
      positionId: positionA.id,
      label: 'x',
      type: 'short_answer' as const,
      required: true,
      options: [] as string[],
      allowOther: false,
      format: null,
    };
    actAs(managerB);
    await expect(createPositionQuestion(input)).rejects.toThrow();
    actAs(applicant);
    await expect(createPositionQuestion(input)).rejects.toThrow();

    const existing = await createTestPositionQuestion(positionA, managerA);
    actAs(managerB);
    await expect(
      updatePositionQuestion({ id: existing.id, ...input }),
    ).rejects.toThrow();
    await expect(
      deletePositionQuestion({ id: existing.id, positionId: positionA.id }),
    ).rejects.toThrow();
    actAs(applicant);
    await expect(
      updatePositionQuestion({ id: existing.id, ...input }),
    ).rejects.toThrow();
    await expect(
      deletePositionQuestion({ id: existing.id, positionId: positionA.id }),
    ).rejects.toThrow();
  });
});
