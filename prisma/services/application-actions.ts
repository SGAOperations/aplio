'use server';

import { revalidatePath } from 'next/cache';

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
  positionId: string,
): Promise<DraftApplication> {
  const currentUser = await getCurrentUser();

  const existing = await prisma.application.findUnique({
    where: { userId_positionId: { userId: currentUser.id, positionId } },
    include: { globalAnswers: true, positionAnswers: true },
  });

  if (existing) return existing;

  const globalAnswers = await prisma.globalAnswer.findMany({
    where: { userId: currentUser.id, deletedAt: null },
    include: { globalQuestion: true },
  });

  return prisma.application.create({
    data: {
      userId: currentUser.id,
      positionId,
      status: 'draft',
      createdById: currentUser.id,
      updatedById: currentUser.id,
      globalAnswers: {
        create: globalAnswers.map((answer: GlobalAnswerWithQuestion) => ({
          globalQuestionId: answer.globalQuestionId,
          questionLabel: answer.globalQuestion.label,
          value: answer.value,
          createdById: currentUser.id,
          updatedById: currentUser.id,
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
}): Promise<ResponseType<GlobalApplicationAnswer | PositionApplicationAnswer>> {
  const { applicationId, questionId, questionLabel, value, isGlobal } = params;

  const currentUser = await getCurrentUser();

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { userId: true },
  });

  if (!application || application.userId !== currentUser.id)
    return { error: 'Unauthorized' };

  if (isGlobal) {
    const result = await prisma.globalApplicationAnswer.upsert({
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
    revalidatePath('/positions');
    return result;
  }

  const result = await prisma.positionApplicationAnswer.upsert({
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
  revalidatePath('/positions');
  return result;
}

export async function submitApplication(
  applicationId: string,
): Promise<ResponseType<Application>> {
  const currentUser = await getCurrentUser();

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      globalAnswers: true,
      positionAnswers: true,
      position: { include: { questions: { where: { deletedAt: null } } } },
    },
  });

  if (!application || application.userId !== currentUser.id)
    return { error: 'Unauthorized' };

  const requiredGlobalQuestions = await prisma.globalQuestion.findMany({
    where: { required: true, deletedAt: null },
  });

  const hasUnansweredGlobal = requiredGlobalQuestions.some(
    (q) =>
      !application.globalAnswers.some(
        (a) => a.globalQuestionId === q.id && (a.value as string[]).length > 0,
      ),
  );

  if (hasUnansweredGlobal)
    return {
      error: 'Please answer all required profile questions before submitting.',
    };

  const hasUnansweredPosition = application.position.questions.some(
    (q) =>
      q.required &&
      !application.positionAnswers.some(
        (a) =>
          a.positionQuestionId === q.id && (a.value as string[]).length > 0,
      ),
  );

  if (hasUnansweredPosition)
    return { error: 'Please answer all required questions before submitting.' };

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      status: 'applied',
      submittedAt: new Date(),
      updatedById: currentUser.id,
    },
  });
  revalidatePath('/applications');
  revalidatePath('/positions');
  return updated;
}
