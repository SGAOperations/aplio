'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod/v4';

import { getCurrentUser } from '@/lib/auth/server';
import prisma from '@/lib/prisma';

const questionTypeSchema = z.enum([
  'short_answer',
  'long_answer',
  'single_choice',
  'multiple_choice',
]);

const createPositionQuestionSchema = z.object({
  positionId: z.string().min(1),
  label: z.string().min(1),
  type: questionTypeSchema,
  required: z.boolean(),
  options: z.array(z.string()).optional().default([]),
});

const updatePositionQuestionSchema = z.object({
  id: z.string().min(1),
  positionId: z.string().min(1),
  label: z.string().min(1),
  type: questionTypeSchema,
  required: z.boolean(),
  options: z.array(z.string()).optional().default([]),
});

const deletePositionQuestionSchema = z.object({
  id: z.string().min(1),
  positionId: z.string().min(1),
});

async function checkAccess(
  positionId: string,
  userId: string,
  isAdmin: boolean,
): Promise<boolean> {
  if (isAdmin) return true;

  const position = await prisma.position.findFirst({
    where: { id: positionId, deletedAt: null },
    include: { managers: { where: { id: userId } } },
  });

  return (position?.managers.length ?? 0) > 0;
}

export async function createPositionQuestion(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();

  const parsed = createPositionQuestionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const { positionId, label, type, required, options } = parsed.data;

  const hasAccess = await checkAccess(positionId, user.id, user.isAdmin);
  if (!hasAccess) return { ok: false, error: 'Unauthorized' };

  const maxOrder = await prisma.positionQuestion.aggregate({
    where: { positionId, deletedAt: null },
    _max: { order: true },
  });

  const order = (maxOrder._max.order ?? 0) + 1;

  await prisma.positionQuestion.create({
    data: {
      positionId,
      label,
      type,
      required,
      order,
      options,
      createdById: user.id,
      updatedById: user.id,
    },
  });

  revalidatePath(`/positions/${positionId}/edit`);
  return { ok: true };
}

export async function updatePositionQuestion(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();

  const parsed = updatePositionQuestionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const { id, positionId, label, type, required, options } = parsed.data;

  const hasAccess = await checkAccess(positionId, user.id, user.isAdmin);
  if (!hasAccess) return { ok: false, error: 'Unauthorized' };

  await prisma.positionQuestion.update({
    where: { id },
    data: { label, type, required, options, updatedById: user.id },
  });

  revalidatePath(`/positions/${positionId}/edit`);
  return { ok: true };
}

export async function deletePositionQuestion(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();

  const parsed = deletePositionQuestionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const { id, positionId } = parsed.data;

  const hasAccess = await checkAccess(positionId, user.id, user.isAdmin);
  if (!hasAccess) return { ok: false, error: 'Unauthorized' };

  await prisma.positionQuestion.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  revalidatePath(`/positions/${positionId}/edit`);
  return { ok: true };
}
