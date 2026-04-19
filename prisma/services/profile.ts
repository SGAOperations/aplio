import { GlobalAnswer, GlobalQuestion } from '@/prisma/client';

import prisma from '@/lib/prisma';
import { ResponseType } from '@/lib/utils';

export async function getProfileData(
  userId: string,
): Promise<{ question: GlobalQuestion; answer: GlobalAnswer | null }[]> {
  const questions = await prisma.globalQuestion.findMany({
    where: { deletedAt: null },
    orderBy: { order: 'asc' },
    include: { answers: { where: { userId } } },
  });

  return questions.map((row) => {
    const { answers, ...question } = row;
    return { question, answer: answers[0] ?? null };
  });
}

export async function upsertGlobalAnswer(
  userId: string,
  questionId: string,
  value: string[],
): Promise<ResponseType<GlobalAnswer>> {
  'use server';

  try {
    return await prisma.globalAnswer.upsert({
      where: {
        userId_globalQuestionId: { userId, globalQuestionId: questionId },
      },
      update: { value, updatedById: userId },
      create: {
        userId,
        globalQuestionId: questionId,
        value,
        createdById: userId,
        updatedById: userId,
      },
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' };
  }
}
