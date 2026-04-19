'use server';

import type { GlobalAnswer } from '@/prisma/client';

import prisma from '@/lib/prisma';

export async function updateGlobalAnswer(
  userId: string,
  questionId: string,
  value: string[],
): Promise<GlobalAnswer> {
  return prisma.globalAnswer.upsert({
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
}
