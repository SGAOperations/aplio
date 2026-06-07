'use server';

import type {
  Application,
  GlobalAnswer,
  GlobalApplicationAnswer,
  GlobalQuestion,
  PositionApplicationAnswer,
} from '@/prisma/client';

import { getCurrentUser } from '@/lib/auth/server';
import prisma from '@/lib/prisma';
import { type DraftApplication } from '@/lib/types';
import { type ResponseType } from '@/lib/utils';

type GlobalAnswerWithQuestion = GlobalAnswer & {
  globalQuestion: GlobalQuestion;
};

export async function createDraftApplication(
  userId: string,
  positionId: string,
): Promise<DraftApplication> {
  const existing = await prisma.application.findUnique({
    where: { userId_positionId: { userId, positionId } },
    include: { globalAnswers: true, positionAnswers: true },
  });

  if (existing) return existing;

  const globalAnswers = await prisma.globalAnswer.findMany({
    where: { userId, deletedAt: null },
    include: { globalQuestion: true },
  });

  return prisma.application.create({
    data: {
      userId,
      positionId,
      status: 'draft',
      createdById: userId,
      updatedById: userId,
      globalAnswers: {
        create: globalAnswers.map((answer: GlobalAnswerWithQuestion) => ({
          globalQuestionId: answer.globalQuestionId,
          questionLabel: answer.globalQuestion.label,
          value: answer.value,
          createdById: userId,
          updatedById: userId,
        })),
      },
    },
    include: { globalAnswers: true, positionAnswers: true },
  });
}

export async function createOrUpdateApplicationAnswer(params: {
  applicationId: string;
  questionId: string;
  questionLabel: string;
  value: string[];
  isGlobal: boolean;
}): Promise<GlobalApplicationAnswer | PositionApplicationAnswer> {
  const { applicationId, questionId, questionLabel, value, isGlobal } = params;

  const currentUser = await getCurrentUser();

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { userId: true },
  });

  if (!application || application.userId !== currentUser.id)
    throw new Error('Unauthorized');

  if (isGlobal)
    return prisma.globalApplicationAnswer.upsert({
      where: {
        applicationId_globalQuestionId: {
          applicationId,
          globalQuestionId: questionId,
        },
      },
      update: { value, updatedById: currentUser.id },
      create: {
        applicationId,
        globalQuestionId: questionId,
        questionLabel,
        value,
        createdById: currentUser.id,
        updatedById: currentUser.id,
      },
    });

  return prisma.positionApplicationAnswer.upsert({
    where: {
      applicationId_positionQuestionId: {
        applicationId,
        positionQuestionId: questionId,
      },
    },
    update: { value, updatedById: currentUser.id },
    create: {
      applicationId,
      positionQuestionId: questionId,
      questionLabel,
      value,
      createdById: currentUser.id,
      updatedById: currentUser.id,
    },
  });
}

export async function submitApplication(
  applicationId: string,
  userId: string,
): Promise<ResponseType<Application>> {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    include: {
      positionAnswers: true,
      position: { include: { questions: { where: { deletedAt: null } } } },
    },
  });

  if (!application) return { error: 'Unauthorized' };

  const hasUnanswered = application.position.questions.some(
    (q) =>
      q.required &&
      !application.positionAnswers.some(
        (a) =>
          a.positionQuestionId === q.id && (a.value as string[]).length > 0,
      ),
  );

  if (hasUnanswered)
    return { error: 'Please answer all required questions before submitting.' };

  return prisma.application.update({
    where: { id: applicationId },
    data: { status: 'applied', submittedAt: new Date(), updatedById: userId },
  });
}
