'use server';

import type {
  Application,
  GlobalAnswer,
  GlobalApplicationAnswer,
  GlobalQuestion,
  PositionApplicationAnswer,
} from '@/prisma/client';

import prisma from '@/lib/prisma';
import { type ResponseType } from '@/lib/utils';

type GlobalAnswerWithQuestion = GlobalAnswer & {
  globalQuestion: GlobalQuestion;
};

export async function createDraftApplication(
  userId: string,
  positionId: string,
): Promise<Application> {
  const existing = await prisma.application.findUnique({
    where: { userId_positionId: { userId, positionId } },
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
  });
}

export async function createOrUpdateApplicationAnswer(params: {
  applicationId: string;
  questionId: string;
  questionLabel: string;
  value: string[];
  isGlobal: boolean;
  userId: string;
}): Promise<GlobalApplicationAnswer | PositionApplicationAnswer> {
  const { applicationId, questionId, questionLabel, value, isGlobal, userId } =
    params;

  if (isGlobal) {
    const existing = await prisma.globalApplicationAnswer.findFirst({
      where: { applicationId, globalQuestionId: questionId },
    });

    if (existing)
      return prisma.globalApplicationAnswer.update({
        where: { id: existing.id },
        data: { value, updatedById: userId },
      });

    return prisma.globalApplicationAnswer.create({
      data: {
        applicationId,
        globalQuestionId: questionId,
        questionLabel,
        value,
        createdById: userId,
        updatedById: userId,
      },
    });
  }

  const existing = await prisma.positionApplicationAnswer.findFirst({
    where: { applicationId, positionQuestionId: questionId },
  });

  if (existing)
    return prisma.positionApplicationAnswer.update({
      where: { id: existing.id },
      data: { value, updatedById: userId },
    });

  return prisma.positionApplicationAnswer.create({
    data: {
      applicationId,
      positionQuestionId: questionId,
      questionLabel,
      value,
      createdById: userId,
      updatedById: userId,
    },
  });
}

export async function submitApplication(
  applicationId: string,
  userId: string,
): Promise<ResponseType<Application>> {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId },
  });

  if (!application) return { error: 'Unauthorized' };

  return prisma.application.update({
    where: { id: applicationId },
    data: { status: 'applied', submittedAt: new Date(), updatedById: userId },
  });
}
