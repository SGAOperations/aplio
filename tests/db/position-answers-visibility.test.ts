import {
  cleanupFixtures,
  createTestApplication,
  createTestPosition,
  createTestPositionQuestion,
  createTestUser,
} from '@/tests/helpers/fixtures';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { User } from '@/prisma/client';
import {
  getApplicationForReview,
  getMyApplication,
  getMyApplications,
  getRecentMyApplications,
} from '@/prisma/data/applications';

import { prisma } from '@/lib/prisma';

let admin: User;

beforeAll(async () => {
  admin = await createTestUser({ isAdmin: true });
});

afterAll(async () => {
  await cleanupFixtures();
});

describe('getApplicationForReview hasPositionQuestions', () => {
  it('is false for a position with no position-specific questions', async () => {
    const applicant = await createTestUser();
    const position = await createTestPosition(admin);
    const application = await createTestApplication(applicant, position, {
      status: 'applied',
      submittedAt: new Date(),
    });

    const forReview = await getApplicationForReview(application.id, admin);
    expect(forReview?.hasPositionQuestions).toBe(false);
    expect(forReview?.positionAnswers).toHaveLength(0);
  });

  it('is true for a position with an unanswered question', async () => {
    const applicant = await createTestUser();
    const position = await createTestPosition(admin);
    await createTestPositionQuestion(position, admin);
    const application = await createTestApplication(applicant, position, {
      status: 'applied',
      submittedAt: new Date(),
    });

    const forReview = await getApplicationForReview(application.id, admin);
    expect(forReview?.hasPositionQuestions).toBe(true);
    expect(forReview?.positionAnswers).toHaveLength(0);
  });

  it('is false once every question is soft-deleted, even with live answers', async () => {
    const applicant = await createTestUser();
    const position = await createTestPosition(admin);
    const question = await createTestPositionQuestion(position, admin);
    const application = await createTestApplication(applicant, position, {
      status: 'applied',
      submittedAt: new Date(),
    });
    await prisma.positionApplicationAnswer.create({
      data: {
        applicationId: application.id,
        positionQuestionId: question.id,
        questionLabel: question.label,
        questionType: question.type,
        value: ['answer'],
        createdById: applicant.id,
        updatedById: applicant.id,
      },
    });

    await prisma.positionQuestion.update({
      where: { id: question.id },
      data: { deletedAt: new Date(), deletedById: admin.id },
    });

    const forReview = await getApplicationForReview(application.id, admin);
    expect(forReview?.hasPositionQuestions).toBe(false);
    expect(forReview?.positionAnswers).toHaveLength(1);
  });
});

describe('getMyApplication hasPositionQuestions', () => {
  it('is false for a position with no position-specific questions', async () => {
    const applicant = await createTestUser();
    const position = await createTestPosition(admin);
    const application = await createTestApplication(applicant, position, {
      status: 'applied',
      submittedAt: new Date(),
    });

    const mine = await getMyApplication(application.id, applicant.id);
    expect(mine?.hasPositionQuestions).toBe(false);
    expect(mine?.positionAnswers).toHaveLength(0);
    expect(mine?.position).not.toHaveProperty('_count');
  });

  it('is true for a position with an unanswered question', async () => {
    const applicant = await createTestUser();
    const position = await createTestPosition(admin);
    await createTestPositionQuestion(position, admin);
    const application = await createTestApplication(applicant, position, {
      status: 'applied',
      submittedAt: new Date(),
    });

    const mine = await getMyApplication(application.id, applicant.id);
    expect(mine?.hasPositionQuestions).toBe(true);
    expect(mine?.positionAnswers).toHaveLength(0);
  });

  it('is false once every question is soft-deleted, even with live answers', async () => {
    const applicant = await createTestUser();
    const position = await createTestPosition(admin);
    const question = await createTestPositionQuestion(position, admin);
    const application = await createTestApplication(applicant, position, {
      status: 'applied',
      submittedAt: new Date(),
    });
    await prisma.positionApplicationAnswer.create({
      data: {
        applicationId: application.id,
        positionQuestionId: question.id,
        questionLabel: question.label,
        questionType: question.type,
        value: ['answer'],
        createdById: applicant.id,
        updatedById: applicant.id,
      },
    });

    await prisma.positionQuestion.update({
      where: { id: question.id },
      data: { deletedAt: new Date(), deletedById: admin.id },
    });

    const mine = await getMyApplication(application.id, applicant.id);
    expect(mine?.hasPositionQuestions).toBe(false);
    expect(mine?.positionAnswers).toHaveLength(1);
  });

  it('does not add a count field to the list queries', async () => {
    const applicant = await createTestUser();
    const position = await createTestPosition(admin);
    await createTestPositionQuestion(position, admin);
    await createTestApplication(applicant, position, {
      status: 'applied',
      submittedAt: new Date(),
    });

    const [list, recent] = await Promise.all([
      getMyApplications(applicant.id),
      getRecentMyApplications(applicant.id),
    ]);

    expect(list.length).toBeGreaterThan(0);
    for (const row of list) expect(row.position).not.toHaveProperty('_count');
    expect(recent.length).toBeGreaterThan(0);
    for (const row of recent) expect(row.position).not.toHaveProperty('_count');
  });
});
