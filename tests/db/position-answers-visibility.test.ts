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

  it('is true for a position with an unanswered question, and lists it as a placeholder', async () => {
    const applicant = await createTestUser();
    const position = await createTestPosition(admin);
    const question = await createTestPositionQuestion(position, admin, {
      label: 'Why this role?',
    });
    const application = await createTestApplication(applicant, position, {
      status: 'applied',
      submittedAt: new Date(),
    });

    const forReview = await getApplicationForReview(application.id, admin);
    expect(forReview?.hasPositionQuestions).toBe(true);
    expect(forReview?.positionAnswers).toHaveLength(1);
    expect(forReview?.positionAnswers[0]).toMatchObject({
      questionId: question.id,
      questionLabel: 'Why this role?',
      value: [],
    });
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

  it('orders the merged list by PositionQuestion.order, not by answer save order', async () => {
    const applicant = await createTestUser();
    const position = await createTestPosition(admin);
    const first = await createTestPositionQuestion(position, admin, {
      order: 1,
      label: 'First',
    });
    const second = await createTestPositionQuestion(position, admin, {
      order: 2,
      label: 'Second',
    });
    const application = await createTestApplication(applicant, position, {
      status: 'applied',
      submittedAt: new Date(),
    });

    // Answer the second question first, so createdAt order is reversed.
    await prisma.positionApplicationAnswer.create({
      data: {
        applicationId: application.id,
        positionQuestionId: second.id,
        questionLabel: second.label,
        questionType: second.type,
        value: ['b'],
        createdById: applicant.id,
        updatedById: applicant.id,
      },
    });
    await prisma.positionApplicationAnswer.create({
      data: {
        applicationId: application.id,
        positionQuestionId: first.id,
        questionLabel: first.label,
        questionType: first.type,
        value: ['a'],
        createdById: applicant.id,
        updatedById: applicant.id,
      },
    });

    const forReview = await getApplicationForReview(application.id, admin);
    expect(forReview?.positionAnswers.map((a) => a.questionId)).toEqual([
      first.id,
      second.id,
    ]);
  });

  it('keeps an answered row on its snapshotted label while a placeholder tracks the live label', async () => {
    const applicant = await createTestUser();
    const position = await createTestPosition(admin);
    const answered = await createTestPositionQuestion(position, admin, {
      order: 1,
      label: 'Original label',
    });
    const unanswered = await createTestPositionQuestion(position, admin, {
      order: 2,
      label: 'Unanswered label',
    });
    const application = await createTestApplication(applicant, position, {
      status: 'applied',
      submittedAt: new Date(),
    });
    await prisma.positionApplicationAnswer.create({
      data: {
        applicationId: application.id,
        positionQuestionId: answered.id,
        questionLabel: answered.label,
        questionType: answered.type,
        value: ['yes'],
        createdById: applicant.id,
        updatedById: applicant.id,
      },
    });

    await prisma.positionQuestion.update({
      where: { id: answered.id },
      data: { label: 'Renamed label' },
    });
    await prisma.positionQuestion.update({
      where: { id: unanswered.id },
      data: { label: 'Renamed unanswered label' },
    });

    const forReview = await getApplicationForReview(application.id, admin);
    const answeredRow = forReview?.positionAnswers.find(
      (a) => a.questionId === answered.id,
    );
    const placeholderRow = forReview?.positionAnswers.find(
      (a) => a.questionId === unanswered.id,
    );
    expect(answeredRow?.questionLabel).toBe('Original label');
    expect(answeredRow?.value).toEqual(['yes']);
    expect(placeholderRow?.questionLabel).toBe('Renamed unanswered label');
    expect(placeholderRow?.value).toEqual([]);
  });

  it('sorts an answer to a soft-deleted question after the live questions', async () => {
    const applicant = await createTestUser();
    const position = await createTestPosition(admin);
    const deleted = await createTestPositionQuestion(position, admin, {
      order: 1,
    });
    const live = await createTestPositionQuestion(position, admin, {
      order: 2,
    });
    const application = await createTestApplication(applicant, position, {
      status: 'applied',
      submittedAt: new Date(),
    });
    await prisma.positionApplicationAnswer.create({
      data: {
        applicationId: application.id,
        positionQuestionId: deleted.id,
        questionLabel: deleted.label,
        questionType: deleted.type,
        value: ['answer'],
        createdById: applicant.id,
        updatedById: applicant.id,
      },
    });
    await prisma.positionQuestion.update({
      where: { id: deleted.id },
      data: { deletedAt: new Date(), deletedById: admin.id },
    });

    const forReview = await getApplicationForReview(application.id, admin);
    expect(forReview?.positionAnswers.map((a) => a.questionId)).toEqual([
      live.id,
      deleted.id,
    ]);
    expect(forReview?.positionAnswers[1]?.value).toEqual(['answer']);
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
    expect(mine?.position).not.toHaveProperty('questions');
  });

  it('is true for a position with an unanswered question, and lists it as a placeholder', async () => {
    const applicant = await createTestUser();
    const position = await createTestPosition(admin);
    const question = await createTestPositionQuestion(position, admin, {
      label: 'Why this role?',
    });
    const application = await createTestApplication(applicant, position, {
      status: 'applied',
      submittedAt: new Date(),
    });

    const mine = await getMyApplication(application.id, applicant.id);
    expect(mine?.hasPositionQuestions).toBe(true);
    expect(mine?.positionAnswers).toHaveLength(1);
    expect(mine?.positionAnswers[0]).toMatchObject({
      questionId: question.id,
      questionLabel: 'Why this role?',
      value: [],
    });
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

  it('orders the merged list by PositionQuestion.order, not by answer save order', async () => {
    const applicant = await createTestUser();
    const position = await createTestPosition(admin);
    const first = await createTestPositionQuestion(position, admin, {
      order: 1,
      label: 'First',
    });
    const second = await createTestPositionQuestion(position, admin, {
      order: 2,
      label: 'Second',
    });
    const application = await createTestApplication(applicant, position, {
      status: 'applied',
      submittedAt: new Date(),
    });

    await prisma.positionApplicationAnswer.create({
      data: {
        applicationId: application.id,
        positionQuestionId: second.id,
        questionLabel: second.label,
        questionType: second.type,
        value: ['b'],
        createdById: applicant.id,
        updatedById: applicant.id,
      },
    });
    await prisma.positionApplicationAnswer.create({
      data: {
        applicationId: application.id,
        positionQuestionId: first.id,
        questionLabel: first.label,
        questionType: first.type,
        value: ['a'],
        createdById: applicant.id,
        updatedById: applicant.id,
      },
    });

    const mine = await getMyApplication(application.id, applicant.id);
    expect(mine?.positionAnswers.map((a) => a.questionId)).toEqual([
      first.id,
      second.id,
    ]);
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
