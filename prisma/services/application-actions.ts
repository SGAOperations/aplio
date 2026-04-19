'use server';

import type {
  Application,
  GlobalApplicationAnswer,
  PositionApplicationAnswer,
  Prisma,
} from '@/prisma/client';

import prisma from '@/lib/prisma';
import { type ResponseType } from '@/lib/utils';

export async function createDraftApplication(
  userId: string,
  positionId: string,
): Promise<ResponseType<Application>> {
  try {
    const existing = await prisma.application.findUnique({
      where: { userId_positionId: { userId, positionId } },
    });

    if (existing) return existing;

    const globalAnswers = await prisma.globalAnswer.findMany({
      where: { userId, deletedAt: null },
      include: { globalQuestion: true },
    });

    type GlobalAnswerWithQuestion = Prisma.GlobalAnswerGetPayload<{
      include: { globalQuestion: true };
    }>;

    const application = await prisma.application.create({
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

    return application;
  } catch {
    return { error: 'Failed to create draft application' };
  }
}

export async function upsertApplicationAnswer(params: {
  applicationId: string;
  questionId: string;
  questionLabel: string;
  value: string[];
  isGlobal: boolean;
  userId: string;
}): Promise<ResponseType<GlobalApplicationAnswer | PositionApplicationAnswer>> {
  const { applicationId, questionId, questionLabel, value, isGlobal, userId } =
    params;

  try {
    if (isGlobal) {
      const existing = await prisma.globalApplicationAnswer.findFirst({
        where: { applicationId, globalQuestionId: questionId },
      });

      if (existing) {
        return prisma.globalApplicationAnswer.update({
          where: { id: existing.id },
          data: { value, updatedById: userId },
        });
      }

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

    if (existing) {
      return prisma.positionApplicationAnswer.update({
        where: { id: existing.id },
        data: { value, updatedById: userId },
      });
    }

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
  } catch {
    return { error: 'Failed to upsert application answer' };
  }
}

export async function submitApplication(
  applicationId: string,
  userId: string,
): Promise<ResponseType<Application>> {
  try {
    const application = await prisma.application.findFirst({
      where: { id: applicationId, userId },
    });

    if (!application) return { error: 'Application not found' };

    return prisma.application.update({
      where: { id: applicationId },
      data: { status: 'applied', submittedAt: new Date(), updatedById: userId },
    });
  } catch {
    return { error: 'Failed to submit application' };
  }
}
