import {
  cleanupFixtures,
  createTestApplication,
  createTestGlobalQuestion,
  createTestPosition,
  createTestUser,
} from '@/tests/helpers/fixtures';
import { actAs } from '@/tests/stubs/auth-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createDraftApplication,
  createOrUpdateApplicationAnswer,
  deleteDraftApplication,
  restoreDraftApplication,
  submitApplication,
} from '@/prisma/actions/applications';
import type { GlobalQuestion, Position, User } from '@/prisma/client';
import {
  getApplications,
  getMyApplicationStatusCounts,
  getMyApplications,
} from '@/prisma/data/applications';

import { buildApplicationWhere } from '@/lib/auth/scopes';
import { prisma } from '@/lib/prisma';
import { isError } from '@/lib/utils';

// Mirrors the (deliberately unexported) copy in prisma/actions/applications.ts —
// asserting the exact sentence is the point of this suite.
const DRAFT_DELETED_MESSAGE =
  'You deleted this draft. Restore it from My Applications to keep working on it.';
const DRAFT_DELETE_NOT_ALLOWED_MESSAGE = 'This draft can no longer be deleted.';
const DRAFT_RESTORE_NOT_ALLOWED_MESSAGE =
  'This draft can no longer be restored.';

let admin: User;
let openPosition: Position;
let globalQuestion: GlobalQuestion;

beforeAll(async () => {
  admin = await createTestUser({ isAdmin: true });
  openPosition = await createTestPosition(admin);
  globalQuestion = await createTestGlobalQuestion(admin, { required: false });
});

afterAll(async () => {
  await cleanupFixtures();
});

describe('delete / restore lifecycle', () => {
  it('delete leaves both answer tables untouched and soft-deletes the row', async () => {
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, openPosition, {
      status: 'draft',
    });
    await prisma.globalApplicationAnswer.create({
      data: {
        applicationId: application.id,
        globalQuestionId: globalQuestion.id,
        questionLabel: globalQuestion.label,
        questionType: globalQuestion.type,
        value: ['hello'],
        createdById: applicant.id,
        updatedById: applicant.id,
      },
    });

    actAs(applicant);
    const result = await deleteDraftApplication(application.id);
    expect(result).toBeUndefined();

    const deleted = await prisma.application.findUniqueOrThrow({
      where: { id: application.id },
    });
    expect(deleted.deletedAt).not.toBeNull();
    expect(deleted.deletedById).toBe(applicant.id);
    expect(deleted.status).toBe('draft');

    const answers = await prisma.globalApplicationAnswer.findMany({
      where: { applicationId: application.id },
    });
    expect(answers).toHaveLength(1);
    expect(answers[0]?.value).toEqual(['hello']);
  });

  it('restore clears deletedAt/deletedById with answers byte-identical', async () => {
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, openPosition, {
      status: 'draft',
    });
    const answer = await prisma.globalApplicationAnswer.create({
      data: {
        applicationId: application.id,
        globalQuestionId: globalQuestion.id,
        questionLabel: globalQuestion.label,
        questionType: globalQuestion.type,
        value: ['preserved'],
        createdById: applicant.id,
        updatedById: applicant.id,
      },
    });

    actAs(applicant);
    await deleteDraftApplication(application.id);

    const restoreResult = await restoreDraftApplication(application.id);
    expect(restoreResult).toBeUndefined();

    const restored = await prisma.application.findUniqueOrThrow({
      where: { id: application.id },
    });
    expect(restored.deletedAt).toBeNull();
    expect(restored.deletedById).toBeNull();

    const restoredAnswer =
      await prisma.globalApplicationAnswer.findUniqueOrThrow({
        where: { id: answer.id },
      });
    expect(restoredAnswer.value).toEqual(['preserved']);
  });

  it('double restore returns the error', async () => {
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, openPosition, {
      status: 'draft',
    });

    actAs(applicant);
    await deleteDraftApplication(application.id);
    const first = await restoreDraftApplication(application.id);
    expect(first).toBeUndefined();

    const second = await restoreDraftApplication(application.id);
    expect(second).toEqual({ error: DRAFT_RESTORE_NOT_ALLOWED_MESSAGE });
  });

  it('restoring a draft that was never deleted returns the error', async () => {
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, openPosition, {
      status: 'draft',
    });

    actAs(applicant);
    const result = await restoreDraftApplication(application.id);
    expect(result).toEqual({ error: DRAFT_RESTORE_NOT_ALLOWED_MESSAGE });
  });

  it('deleting an already-deleted draft returns the error, not a second soft-delete', async () => {
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, openPosition, {
      status: 'draft',
    });

    actAs(applicant);
    await deleteDraftApplication(application.id);
    const secondDelete = await deleteDraftApplication(application.id);
    expect(secondDelete).toEqual({ error: DRAFT_DELETE_NOT_ALLOWED_MESSAGE });
  });
});

describe('write paths reject a soft-deleted draft', () => {
  it('createDraftApplication returns DRAFT_DELETED_MESSAGE and creates no second row', async () => {
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, openPosition, {
      status: 'draft',
    });

    actAs(applicant);
    await deleteDraftApplication(application.id);

    const result = await createDraftApplication({
      positionId: openPosition.id,
    });
    expect(result).toEqual({ error: DRAFT_DELETED_MESSAGE });

    const rows = await prisma.application.findMany({
      where: { userId: applicant.id, positionId: openPosition.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(application.id);
  });

  it('createOrUpdateApplicationAnswer returns DRAFT_DELETED_MESSAGE and writes nothing', async () => {
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, openPosition, {
      status: 'draft',
    });

    actAs(applicant);
    await deleteDraftApplication(application.id);

    const result = await createOrUpdateApplicationAnswer({
      applicationId: application.id,
      questionId: globalQuestion.id,
      value: ['nope'],
    });
    expect(result).toEqual({ error: DRAFT_DELETED_MESSAGE });

    const answers = await prisma.globalApplicationAnswer.findMany({
      where: { applicationId: application.id },
    });
    expect(answers).toHaveLength(0);
  });

  it('submitApplication returns DRAFT_DELETED_MESSAGE and does not flip status', async () => {
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, openPosition, {
      status: 'draft',
    });

    actAs(applicant);
    await deleteDraftApplication(application.id);

    const result = await submitApplication(application.id);
    expect(result).toEqual({ error: DRAFT_DELETED_MESSAGE });

    const unchanged = await prisma.application.findUniqueOrThrow({
      where: { id: application.id },
    });
    expect(unchanged.status).toBe('draft');
  });
});

describe('reconciliation after restore', () => {
  it('a required global question added while deleted blocks submit, then succeeds once answered', async () => {
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, openPosition, {
      status: 'draft',
    });

    actAs(applicant);
    await deleteDraftApplication(application.id);

    // Very negative order guarantees this label survives formatMissingQuestions'
    // 3-name truncation regardless of how many other required questions exist.
    const newRequiredQuestion = await createTestGlobalQuestion(admin, {
      required: true,
      order: -1_000_000,
    });

    const restoreResult = await restoreDraftApplication(application.id);
    expect(restoreResult).toBeUndefined();

    const blocked = await submitApplication(application.id);
    if (!isError(blocked)) throw new Error('expected an error result');
    expect(blocked.error).toContain(
      'Answer these required profile questions before submitting:',
    );
    expect(blocked.error).toContain(newRequiredQuestion.label);

    await createOrUpdateApplicationAnswer({
      applicationId: application.id,
      questionId: newRequiredQuestion.id,
      value: ['answered'],
    });

    const submitted = await submitApplication(application.id);
    expect(submitted).toBeUndefined();

    const finalApplication = await prisma.application.findUniqueOrThrow({
      where: { id: application.id },
    });
    expect(finalApplication.status).toBe('applied');
  });
});

describe('deleted drafts in list and reviewer queries', () => {
  it('getMyApplications includes a deleted draft while status counts and reviewer queries exclude it', async () => {
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, openPosition, {
      status: 'draft',
    });

    actAs(applicant);
    await deleteDraftApplication(application.id);

    const mine = await getMyApplications(applicant.id);
    expect(mine.map((a) => a.id)).toContain(application.id);
    const deletedRow = mine.find((a) => a.id === application.id);
    expect(deletedRow?.deletedAt).not.toBeNull();

    const counts = await getMyApplicationStatusCounts(applicant.id);
    // A deleted draft never contributes to any status bucket.
    const totalCounted = Object.values(counts).reduce((sum, n) => sum + n, 0);
    const draftApplications = await prisma.application.count({
      where: { userId: applicant.id, status: 'draft', deletedAt: null },
    });
    expect(totalCounted).toBe(draftApplications);

    const reviewerResults = await getApplications(admin, {});
    expect(reviewerResults.map((a) => a.id)).not.toContain(application.id);

    const reviewerWhere = buildApplicationWhere(admin, 'listable');
    const reviewerVisible = await prisma.application.findFirst({
      where: { id: application.id, ...reviewerWhere },
    });
    expect(reviewerVisible).toBeNull();
  });
});
