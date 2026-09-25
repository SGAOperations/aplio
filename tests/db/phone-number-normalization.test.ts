import {
  cleanupFixtures,
  createTestApplication,
  createTestGlobalQuestion,
  createTestPosition,
  createTestUser,
} from '@/tests/helpers/fixtures';
import { actAs } from '@/tests/stubs/auth-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createOrUpdateApplicationAnswer } from '@/prisma/actions/applications';
import { updateGlobalAnswer } from '@/prisma/actions/profile';
import type { Position, User } from '@/prisma/client';

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

describe('phone_number normalization on write', () => {
  it('updateGlobalAnswer stores a digits-only value', async () => {
    const question = await createTestGlobalQuestion(admin, {
      format: 'phone_number',
    });
    const applicant = await createTestUser();

    actAs(applicant);
    const result = await updateGlobalAnswer(question.id, ['(617) 555-0100']);
    expect(isError(result)).toBe(false);

    const answer = await prisma.globalAnswer.findUniqueOrThrow({
      where: {
        userId_globalQuestionId: {
          userId: applicant.id,
          globalQuestionId: question.id,
        },
      },
      select: { value: true },
    });
    expect(answer.value).toEqual(['6175550100']);
  });

  it('createOrUpdateApplicationAnswer stores a digits-only value', async () => {
    const question = await createTestGlobalQuestion(admin, {
      format: 'phone_number',
      required: false,
    });
    const applicant = await createTestUser();
    const draft = await createTestApplication(applicant, openPosition, {
      status: 'draft',
    });

    actAs(applicant);
    const result = await createOrUpdateApplicationAnswer({
      applicationId: draft.id,
      questionId: question.id,
      value: ['(617) 555-0100'],
    });
    expect(isError(result)).toBe(false);

    const answer = await prisma.globalApplicationAnswer.findUniqueOrThrow({
      where: {
        applicationId_globalQuestionId: {
          applicationId: draft.id,
          globalQuestionId: question.id,
        },
      },
      select: { value: true },
    });
    expect(answer.value).toEqual(['6175550100']);
  });
});
