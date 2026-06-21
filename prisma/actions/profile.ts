'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import type { GlobalAnswer } from '@/prisma/client';

import { getCurrentUser } from '@/lib/auth/server';
import prisma from '@/lib/prisma';

const updateGlobalAnswerSchema = z.object({
  questionId: z.string().cuid(),
  value: z.array(z.string()),
});

export async function updateGlobalAnswer(
  questionId: string,
  value: string[],
): Promise<{ ok: true; data: GlobalAnswer } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const parsed = updateGlobalAnswerSchema.safeParse({ questionId, value });
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

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
  return { ok: true, data: result };
}
