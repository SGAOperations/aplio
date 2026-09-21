import {
  answerAllRequiredGlobalQuestions,
  cleanupFixtures,
  createTestApplication,
  createTestGlobalQuestion,
  createTestPosition,
  createTestPositionQuestion,
  createTestUser,
} from '@/tests/helpers/fixtures';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type {
  Application,
  GlobalQuestion,
  Position,
  PositionQuestion,
  User,
} from '@/prisma/client';
import {
  getApplicationCompletion,
  getDraftApplications,
} from '@/prisma/data/applications';

import { prisma } from '@/lib/prisma';

let admin: User;
let managerA: User;
let managerB: User;

let positionA: Position;
let positionB: Position;
let positionNoRequired: Position;
let positionQuestionA: PositionQuestion;

let applicantA: User;
let draftA: Application;
let draftB: Application;
let noRequiredApplicant: User;
let noRequiredDraft: Application;

// Isolates the denominator: any required global question left over from
// another run (or a locally seeded DB) would make every percentage in this
// file nondeterministic. Soft-deleted here, restored in the outer afterAll.
let preexistingGlobalQuestionIds: string[] = [];

beforeAll(async () => {
  const preexisting = await prisma.globalQuestion.findMany({
    where: { required: true, deletedAt: null },
    select: { id: true },
  });
  preexistingGlobalQuestionIds = preexisting.map((q) => q.id);
  if (preexistingGlobalQuestionIds.length > 0)
    await prisma.globalQuestion.updateMany({
      where: { id: { in: preexistingGlobalQuestionIds } },
      data: { deletedAt: new Date() },
    });

  admin = await createTestUser({ isAdmin: true });
  managerA = await createTestUser();
  managerB = await createTestUser();

  positionA = await createTestPosition(admin, { managers: [managerA] });
  positionB = await createTestPosition(admin, { managers: [managerB] });
  positionNoRequired = await createTestPosition(admin, {
    managers: [managerA],
  });

  positionQuestionA = await createTestPositionQuestion(positionA, admin, {
    required: true,
  });
  await createTestPositionQuestion(positionB, admin, { required: true });
  await createTestPositionQuestion(positionNoRequired, admin, {
    required: false,
  });

  applicantA = await createTestUser();
  draftA = await createTestApplication(applicantA, positionA, {
    status: 'draft',
  });

  const applicantB = await createTestUser();
  draftB = await createTestApplication(applicantB, positionB, {
    status: 'draft',
  });

  noRequiredApplicant = await createTestUser();
  noRequiredDraft = await createTestApplication(
    noRequiredApplicant,
    positionNoRequired,
    { status: 'draft' },
  );
});

afterAll(async () => {
  await cleanupFixtures();
  if (preexistingGlobalQuestionIds.length > 0)
    await prisma.globalQuestion.updateMany({
      where: { id: { in: preexistingGlobalQuestionIds } },
      data: { deletedAt: null },
    });
});

describe('getApplicationCompletion', () => {
  it('returns one entry per draft in scope and none outside it', async () => {
    const rows = await getDraftApplications(managerA, {});
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(draftA.id);
    expect(ids).not.toContain(draftB.id);

    const completion = await getApplicationCompletion(
      rows.map((r) => ({
        id: r.id,
        positionId: r.position.id,
        userId: r.user.id,
      })),
    );

    expect(Object.keys(completion).sort()).toEqual([...ids].sort());
    expect(completion[draftB.id]).toBeUndefined();
  });

  it('reports 0% for an unanswered required position question', async () => {
    const completion = await getApplicationCompletion([
      { id: draftA.id, positionId: positionA.id, userId: applicantA.id },
    ]);
    expect(completion[draftA.id]).toEqual({
      answeredCount: 0,
      requiredCount: 1,
      percent: 0,
    });
  });

  it('reports 100% once the required position question is answered', async () => {
    await prisma.positionApplicationAnswer.create({
      data: {
        applicationId: draftA.id,
        positionQuestionId: positionQuestionA.id,
        questionLabel: positionQuestionA.label,
        questionType: positionQuestionA.type,
        value: ['an answer'],
        createdById: applicantA.id,
        updatedById: applicantA.id,
      },
    });

    const completion = await getApplicationCompletion([
      { id: draftA.id, positionId: positionA.id, userId: applicantA.id },
    ]);
    expect(completion[draftA.id]).toEqual({
      answeredCount: 1,
      requiredCount: 1,
      percent: 100,
    });
  });

  it('reports 100% with no NaN when nothing is required', async () => {
    const completion = await getApplicationCompletion([
      {
        id: noRequiredDraft.id,
        positionId: positionNoRequired.id,
        userId: noRequiredApplicant.id,
      },
    ]);
    expect(completion[noRequiredDraft.id]).toEqual({
      answeredCount: 0,
      requiredCount: 0,
      percent: 100,
    });
  });

  describe('a required global answered only on the profile', () => {
    let globalQuestion: GlobalQuestion;
    let applicant: User;
    let draft: Application;

    beforeAll(async () => {
      globalQuestion = await createTestGlobalQuestion(admin, {
        required: true,
      });
      applicant = await createTestUser();
      draft = await createTestApplication(applicant, positionNoRequired, {
        status: 'draft',
      });
      // Profile only — no GlobalApplicationAnswer row on the draft itself.
      await answerAllRequiredGlobalQuestions(applicant);
    });

    afterAll(async () => {
      await prisma.globalQuestion.update({
        where: { id: globalQuestion.id },
        data: { deletedAt: new Date() },
      });
    });

    it('counts the global as answered through the profile fallback', async () => {
      const completion = await getApplicationCompletion([
        {
          id: draft.id,
          positionId: positionNoRequired.id,
          userId: applicant.id,
        },
      ]);
      expect(completion[draft.id]).toEqual({
        answeredCount: 1,
        requiredCount: 1,
        percent: 100,
      });
    });
  });
});
