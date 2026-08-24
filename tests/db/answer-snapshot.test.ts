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
  createOrUpdateApplicationAnswer,
  submitApplication,
} from '@/prisma/actions/applications';
import type { GlobalQuestion, Position, User } from '@/prisma/client';

import { prisma } from '@/lib/prisma';
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

async function setProfileAnswer(
  user: User,
  question: GlobalQuestion,
  value: string[],
) {
  await prisma.globalAnswer.upsert({
    where: {
      userId_globalQuestionId: {
        userId: user.id,
        globalQuestionId: question.id,
      },
    },
    update: { value },
    create: {
      userId: user.id,
      globalQuestionId: question.id,
      value,
      createdById: user.id,
      updatedById: user.id,
    },
  });
}

describe('submitApplication answer snapshot', () => {
  it('keeps a deliberately cleared application answer empty, never refilled from the profile', async () => {
    const question = await createTestGlobalQuestion(admin, { required: false });
    const applicant = await createTestUser();
    await setProfileAnswer(applicant, question, ['profile value']);
    const draft = await createTestApplication(applicant, openPosition, {
      status: 'draft',
    });
    await prisma.globalApplicationAnswer.create({
      data: {
        applicationId: draft.id,
        globalQuestionId: question.id,
        questionLabel: question.label,
        questionType: question.type,
        value: [],
        createdById: applicant.id,
        updatedById: applicant.id,
      },
    });

    actAs(applicant);
    const result = await submitApplication(draft.id);
    expect(result).toBeUndefined();

    const answer = await prisma.globalApplicationAnswer.findUniqueOrThrow({
      where: {
        applicationId_globalQuestionId: {
          applicationId: draft.id,
          globalQuestionId: question.id,
        },
      },
      select: { value: true },
    });
    expect(answer.value).toEqual([]);
  });

  it('materializes a missing snapshot row from the profile at submit', async () => {
    const question = await createTestGlobalQuestion(admin, { required: false });
    const applicant = await createTestUser();
    await setProfileAnswer(applicant, question, ['profile value']);
    const draft = await createTestApplication(applicant, openPosition, {
      status: 'draft',
    });

    actAs(applicant);
    const result = await submitApplication(draft.id);
    expect(result).toBeUndefined();

    const answer = await prisma.globalApplicationAnswer.findUniqueOrThrow({
      where: {
        applicationId_globalQuestionId: {
          applicationId: draft.id,
          globalQuestionId: question.id,
        },
      },
      select: { value: true, questionLabel: true, questionType: true },
    });
    expect(answer.value).toEqual(['profile value']);
    expect(answer.questionLabel).toBe(question.label);
    expect(answer.questionType).toBe(question.type);
  });

  it('does not materialize a row for an unanswered optional global with no profile value', async () => {
    const question = await createTestGlobalQuestion(admin, { required: false });
    const applicant = await createTestUser();
    const draft = await createTestApplication(applicant, openPosition, {
      status: 'draft',
    });

    actAs(applicant);
    const result = await submitApplication(draft.id);
    expect(result).toBeUndefined();

    const answer = await prisma.globalApplicationAnswer.findUnique({
      where: {
        applicationId_globalQuestionId: {
          applicationId: draft.id,
          globalQuestionId: question.id,
        },
      },
    });
    expect(answer).toBeNull();
  });

  it('blocks submission naming a required global question added after the draft, writing nothing', async () => {
    const applicant = await createTestUser();
    const draft = await createTestApplication(applicant, openPosition, {
      status: 'draft',
    });
    // Very negative order guarantees this label survives formatMissingQuestions'
    // 3-name truncation regardless of how many other required questions exist.
    const question = await createTestGlobalQuestion(admin, {
      required: true,
      order: -2_000_000,
    });

    actAs(applicant);
    const result = await submitApplication(draft.id);
    if (!isError(result)) throw new Error('expected an error result');
    expect(result.error).toContain(question.label);

    const answer = await prisma.globalApplicationAnswer.findUnique({
      where: {
        applicationId_globalQuestionId: {
          applicationId: draft.id,
          globalQuestionId: question.id,
        },
      },
    });
    expect(answer).toBeNull();
  });

  it("keeps the answer's snapshotted questionType after the live question type changes", async () => {
    const question = await createTestGlobalQuestion(admin, {
      required: false,
      type: 'short_answer',
    });
    const applicant = await createTestUser();
    const draft = await createTestApplication(applicant, openPosition, {
      status: 'draft',
    });

    actAs(applicant);
    const saved = await createOrUpdateApplicationAnswer({
      applicationId: draft.id,
      questionId: question.id,
      value: ['hello'],
    });
    expect(isError(saved)).toBe(false);

    await prisma.globalQuestion.update({
      where: { id: question.id },
      data: { type: 'single_choice', options: ['a', 'b'] },
    });

    const answer = await prisma.globalApplicationAnswer.findUniqueOrThrow({
      where: {
        applicationId_globalQuestionId: {
          applicationId: draft.id,
          globalQuestionId: question.id,
        },
      },
      select: { questionType: true },
    });
    expect(answer.questionType).toBe('short_answer');
  });
});
