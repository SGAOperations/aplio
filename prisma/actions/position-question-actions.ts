'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod/v4';

import { checkPositionAccess } from '@/prisma/data/managers';

import { getCurrentUser } from '@/lib/auth/server';
import { baseQuestionSchema, validateOptions } from '@/lib/constants';
import { prisma } from '@/lib/prisma';

const createPositionQuestionSchema = baseQuestionSchema
  .extend({ positionId: z.string().min(1) })
  .superRefine(validateOptions);

const updatePositionQuestionSchema = baseQuestionSchema
  .extend({ id: z.string().min(1), positionId: z.string().min(1) })
  .superRefine(validateOptions);

const deletePositionQuestionSchema = z.object({
  id: z.string().min(1),
  positionId: z.string().min(1),
});

export async function createPositionQuestion(
  input: unknown,
): Promise<{ id: string; order: number } | { error: string }> {
  const user = await getCurrentUser();

  const parsed = createPositionQuestionSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { positionId, label, type, required, options, allowOther } =
    parsed.data;

  const hasAccess = await checkPositionAccess(
    positionId,
    user.id,
    user.isAdmin,
  );
  if (!hasAccess) throw new Error('Forbidden');

  const created = await prisma.$transaction(async (tx) => {
    const maxOrder = await tx.positionQuestion.aggregate({
      where: { positionId, deletedAt: null },
      _max: { order: true },
    });

    const order = (maxOrder._max.order ?? 0) + 1;

    return tx.positionQuestion.create({
      data: {
        positionId,
        label,
        type,
        required,
        order,
        options,
        allowOther,
        createdById: user.id,
        updatedById: user.id,
      },
    });
  });

  revalidatePath(`/positions/${positionId}/edit`);
  return { id: created.id, order: created.order };
}

export async function updatePositionQuestion(
  input: unknown,
): Promise<void | { error: string }> {
  const user = await getCurrentUser();

  const parsed = updatePositionQuestionSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { id, positionId, label, type, required, options, allowOther } =
    parsed.data;

  const hasAccess = await checkPositionAccess(
    positionId,
    user.id,
    user.isAdmin,
  );
  if (!hasAccess) throw new Error('Forbidden');

  // Scope the write to positionId to prevent IDOR across positions
  const result = await prisma.positionQuestion.updateMany({
    where: { id, positionId },
    data: { label, type, required, options, allowOther, updatedById: user.id },
  });

  if (result.count === 0) return { error: 'Not found' };

  revalidatePath(`/positions/${positionId}/edit`);
}

export async function deletePositionQuestion(
  input: unknown,
): Promise<void | { error: string }> {
  const user = await getCurrentUser();

  const parsed = deletePositionQuestionSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { id, positionId } = parsed.data;

  const hasAccess = await checkPositionAccess(
    positionId,
    user.id,
    user.isAdmin,
  );
  if (!hasAccess) throw new Error('Forbidden');

  // Scope the write to positionId to prevent IDOR across positions
  const result = await prisma.positionQuestion.updateMany({
    where: { id, positionId },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  if (result.count === 0) return { error: 'Not found' };

  revalidatePath(`/positions/${positionId}/edit`);
}
