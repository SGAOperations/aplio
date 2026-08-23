'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod/v4';

import { checkPositionEditable } from '@/prisma/data/positions';

import { requirePositionAccess } from '@/lib/auth/guards';
import {
  ARCHIVED_POSITION_EDIT_ERROR,
  QUESTION_ORDER_STALE_ERROR,
  baseQuestionSchema,
  reorderIdsSchema,
  validateOptions,
  validateShortAnswerFormat,
} from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { isSameIdSet } from '@/lib/utils';

const createPositionQuestionSchema = baseQuestionSchema
  .extend({ positionId: z.string().min(1) })
  .superRefine(validateOptions)
  .superRefine(validateShortAnswerFormat);

const updatePositionQuestionSchema = baseQuestionSchema
  .extend({ id: z.string().min(1), positionId: z.string().min(1) })
  .superRefine(validateOptions)
  .superRefine(validateShortAnswerFormat);

const deletePositionQuestionSchema = z.object({
  id: z.string().min(1),
  positionId: z.string().min(1),
});

const reorderPositionQuestionsSchema = z.object({
  positionId: z.string().min(1),
  ids: reorderIdsSchema,
});

export async function createPositionQuestion(
  input: unknown,
): Promise<{ id: string; order: number } | { error: string }> {
  const parsed = createPositionQuestionSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { positionId, label, type, required, options, allowOther, format } =
    parsed.data;

  const user = await requirePositionAccess(positionId);

  if (!(await checkPositionEditable(positionId, user)))
    return { error: ARCHIVED_POSITION_EDIT_ERROR };

  // Best-effort append; a concurrent insert can duplicate order, resolved by the read tiebreak.
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
        format,
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
  const parsed = updatePositionQuestionSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { id, positionId, label, type, required, options, allowOther, format } =
    parsed.data;

  const user = await requirePositionAccess(positionId);

  if (!(await checkPositionEditable(positionId, user)))
    return { error: ARCHIVED_POSITION_EDIT_ERROR };

  // Scope the write to positionId to prevent IDOR across positions
  const result = await prisma.positionQuestion.updateMany({
    where: { id, positionId },
    data: {
      label,
      type,
      required,
      options,
      allowOther,
      format,
      updatedById: user.id,
    },
  });

  if (result.count === 0) return { error: 'This question no longer exists.' };

  revalidatePath(`/positions/${positionId}/edit`);
}

export async function reorderPositionQuestions(
  input: unknown,
): Promise<void | { error: string }> {
  const parsed = reorderPositionQuestionsSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { positionId, ids } = parsed.data;

  const user = await requirePositionAccess(positionId);

  if (!(await checkPositionEditable(positionId, user)))
    return { error: ARCHIVED_POSITION_EDIT_ERROR };

  const live = await prisma.positionQuestion.findMany({
    where: { positionId, deletedAt: null },
    select: { id: true },
  });
  if (
    !isSameIdSet(
      ids,
      live.map((q) => q.id),
    )
  )
    return { error: QUESTION_ORDER_STALE_ERROR };

  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.positionQuestion.updateMany({
        where: { id, positionId },
        data: { order: index + 1, updatedById: user.id },
      }),
    ),
  );

  revalidatePath(`/positions/${positionId}/edit`);
}

export async function deletePositionQuestion(
  input: unknown,
): Promise<void | { error: string }> {
  const parsed = deletePositionQuestionSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { id, positionId } = parsed.data;

  const user = await requirePositionAccess(positionId);

  if (!(await checkPositionEditable(positionId, user)))
    return { error: ARCHIVED_POSITION_EDIT_ERROR };

  // Scope the write to positionId to prevent IDOR across positions
  const result = await prisma.positionQuestion.updateMany({
    where: { id, positionId },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  if (result.count === 0) return { error: 'This question no longer exists.' };

  revalidatePath(`/positions/${positionId}/edit`);
}
