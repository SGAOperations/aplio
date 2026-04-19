'use server';

import type { GlobalAnswer } from '@/prisma/client';

import prisma from '@/lib/prisma';
import type { ResponseType } from '@/lib/utils';

export async function updateGlobalAnswer(
  userId: string,
  questionId: string,
  value: string[],
): Promise<ResponseType<GlobalAnswer>> {
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
  } catch {
    return { error: 'Failed to save answer' };
  }
}
