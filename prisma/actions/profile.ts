'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod/v4';

import type { GlobalAnswer } from '@/prisma/client';

import { getCurrentUser } from '@/lib/auth/server';
import { NAME_MAX_LENGTH } from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { type ErrorType, type ResponseType } from '@/lib/utils';

const updateGlobalAnswerSchema = z.object({
  questionId: z.string().min(1),
  value: z.array(z.string()),
});

const setUserNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter your full name.')
    .max(
      NAME_MAX_LENGTH,
      `Name must be ${NAME_MAX_LENGTH} characters or fewer.`,
    ),
});

export async function setUserName(input: unknown): Promise<ErrorType | void> {
  const user = await getCurrentUser();

  const parsed = setUserNameSchema.safeParse(input);
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
  if (!user) return { error: 'Not authenticated' };

  const parsed = updateGlobalAnswerSchema.safeParse({ questionId, value });
  if (!parsed.success) return { error: 'Invalid input' };

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
