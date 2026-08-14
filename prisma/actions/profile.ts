'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod/v4';

import type { GlobalAnswer } from '@/prisma/client';

import { getCurrentUser } from '@/lib/auth/server';
import {
  ANSWER_LONG_MAX_LENGTH,
  ANSWER_MAX_VALUES,
  SHORT_ANSWER_FORMAT_ERROR_MESSAGES,
  getAnswerValueError,
  matchesShortAnswerFormat,
  nameSchema,
} from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { type ErrorType, type ResponseType } from '@/lib/utils';

const updateGlobalAnswerSchema = z.object({
  questionId: z.string().min(1),
  // Pre-DB size guard only — getAnswerValueError below enforces the real limits.
  value: z.array(z.string().max(ANSWER_LONG_MAX_LENGTH)).max(ANSWER_MAX_VALUES),
});

export async function setUserName(input: unknown): Promise<ErrorType | void> {
  const user = await getCurrentUser();

  const parsed = nameSchema.safeParse(input);
  if (!parsed.success) return { error: 'Enter your full name.' };

  // Write scoped to the calling user — no client-supplied ID, no IDOR.
  await prisma.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name },
  });

  revalidatePath('/profile');
  // Revalidate layout so sidebar/nav reflects the new name immediately.
  revalidatePath('/', 'layout');
}

export async function updateGlobalAnswer(
  questionId: string,
  value: string[],
): Promise<ResponseType<GlobalAnswer>> {
  const user = await getCurrentUser();

  const parsed = updateGlobalAnswerSchema.safeParse({ questionId, value });
  if (!parsed.success) return { error: 'Invalid input' };

  const question = await prisma.globalQuestion.findUnique({
    where: { id: parsed.data.questionId },
    select: { type: true, format: true, options: true, allowOther: true },
  });
  if (!question) throw new Error('Question not found');
  // File answers are written only by the actions in question-files.ts.
  if (question.type === 'file_upload')
    throw new Error('Invalid question type for this action');

  // The client blocks this today, but the action can't depend on that.
  if (
    question.type === 'short_answer' &&
    question.format &&
    parsed.data.value[0] &&
    !matchesShortAnswerFormat(parsed.data.value[0], question.format)
  )
    return { error: SHORT_ANSWER_FORMAT_ERROR_MESSAGES[question.format] };

  // Membership, "how many values", and length-limit backstop.
  const answerError = getAnswerValueError(question, parsed.data.value);
  if (answerError) return { error: answerError };

  // matchesShortAnswerFormat trims internally, so save the trimmed value.
  const persistedValue =
    question?.type === 'short_answer' && question.format
      ? parsed.data.value.map((v) => v.trim())
      : parsed.data.value;

  const result = await prisma.globalAnswer.upsert({
    where: {
      userId_globalQuestionId: {
        userId: user.id,
        globalQuestionId: parsed.data.questionId,
      },
    },
    update: { value: persistedValue, updatedById: user.id },
    create: {
      userId: user.id,
      globalQuestionId: parsed.data.questionId,
      value: persistedValue,
      createdById: user.id,
      updatedById: user.id,
    },
  });
  revalidatePath('/profile');
  return result;
}
