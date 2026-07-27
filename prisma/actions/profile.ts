'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod/v4';

import type { GlobalAnswer } from '@/prisma/client';

import { getCurrentUser } from '@/lib/auth/server';
import {
  SHORT_ANSWER_FORMAT_ERROR_MESSAGES,
  matchesShortAnswerFormat,
} from '@/lib/constants';
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
    select: { type: true, format: true },
  });
  if (!question) throw new Error('Question not found');
  // file_upload answers are written exclusively by uploadQuestionFileAnswer /
  // removeQuestionFileAnswer (prisma/actions/question-files.ts).
  if (question.type === 'file_upload')
    throw new Error('Invalid question type for this action');

  // Re-validate the format preset server-side — /profile's autosave (unlike
  // the application flow) never sends a mismatched value at all today
  // (profile-question.tsx blocks it client-side), but this action is the
  // source of truth and must not depend on that client behavior.
  if (
    question.type === 'short_answer' &&
    question.format &&
    parsed.data.value[0] &&
    !matchesShortAnswerFormat(parsed.data.value[0], question.format)
  )
    return { error: SHORT_ANSWER_FORMAT_ERROR_MESSAGES[question.format] };

  // Persist what was actually validated: matchesShortAnswerFormat trims
  // internally, so a format-validated answer must be trimmed before saving
  // too, or a pasted value with incidental whitespace saves verbatim.
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
