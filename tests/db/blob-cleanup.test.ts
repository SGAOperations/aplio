import {
  cleanupFixtures,
  createTestApplication,
  createTestGlobalQuestion,
  createTestPosition,
  createTestPositionQuestion,
  createTestUser,
} from '@/tests/helpers/fixtures';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Position, User } from '@/prisma/client';

import { countAnswerFileReferences } from '@/lib/blobs';
import { prisma } from '@/lib/prisma';

let admin: User;
let position: Position;

beforeAll(async () => {
  admin = await createTestUser({ isAdmin: true });
  position = await createTestPosition(admin);
});

afterAll(async () => {
  await cleanupFixtures();
});

describe('countAnswerFileReferences', () => {
  it('counts a single reference from a profile answer', async () => {
    const question = await createTestGlobalQuestion(admin, {
      type: 'file_upload',
      required: false,
    });
    const applicant = await createTestUser();
    const url = `https://blob.example/${randomUUID()}`;
    await prisma.globalAnswer.create({
      data: {
        userId: applicant.id,
        globalQuestionId: question.id,
        value: [url],
        createdById: applicant.id,
        updatedById: applicant.id,
      },
    });

    expect(await countAnswerFileReferences(url)).toBe(1);
  });

  it('sums references across global and position application answers', async () => {
    const globalQuestion = await createTestGlobalQuestion(admin, {
      type: 'file_upload',
      required: false,
    });
    const positionQuestion = await createTestPositionQuestion(position, admin, {
      type: 'file_upload',
      required: false,
    });
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, position, {
      status: 'draft',
    });
    const url = `https://blob.example/${randomUUID()}`;

    await prisma.globalApplicationAnswer.create({
      data: {
        applicationId: application.id,
        globalQuestionId: globalQuestion.id,
        questionLabel: globalQuestion.label,
        questionType: globalQuestion.type,
        value: [url],
        createdById: applicant.id,
        updatedById: applicant.id,
      },
    });
    await prisma.positionApplicationAnswer.create({
      data: {
        applicationId: application.id,
        positionQuestionId: positionQuestion.id,
        questionLabel: positionQuestion.label,
        questionType: positionQuestion.type,
        value: [url],
        createdById: applicant.id,
        updatedById: applicant.id,
      },
    });

    expect(await countAnswerFileReferences(url)).toBe(2);
  });

  it('returns 0 for an unreferenced url', async () => {
    const url = `https://blob.example/${randomUUID()}`;
    expect(await countAnswerFileReferences(url)).toBe(0);
  });
});
