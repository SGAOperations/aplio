'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod/v4';

import type { GlobalAnswer } from '@/prisma/client';

import { getCurrentUser } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';
import { type ResponseType } from '@/lib/utils';

const updateGlobalAnswerSchema = z.object({
  questionId: z.string().min(1),
  value: z.array(z.string()),
});

export async function updateGlobalAnswer(
  questionId: string,
  value: string[],
): Promise<ResponseType<GlobalAnswer>> {
  const user = await getCurrentUser();

  const parsed = updateGlobalAnswerSchema.safeParse({ questionId, value });
  if (!parsed.success) return { error: 'Invalid input' };

  const question = await prisma.globalQuestion.findUnique({
    where: { id: parsed.data.questionId },
    select: { type: true },
  });
  if (!question) throw new Error('Question not found');
  // file_upload answers are written exclusively by uploadQuestionFileAnswer /
  // removeQuestionFileAnswer (prisma/actions/question-files.ts).
  if (question.type === 'file_upload')
    throw new Error('Invalid question type for this action');

  const result = await prisma.globalAnswer.upsert({
    where: {
      userId_globalQuestionId: {
        userId: user.id,
        globalQuestionId: parsed.data.questionId,
      },
    },
    update: { value: parsed.data.value, updatedById: user.id },
    create: {
      userId: user.id,
      globalQuestionId: parsed.data.questionId,
      value: parsed.data.value,
      createdById: user.id,
      updatedById: user.id,
    },
  });
  revalidatePath('/profile');
  return result;
}
