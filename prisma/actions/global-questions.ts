'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod/v4';

import { requireAdmin } from '@/lib/auth/guards';
import {
  QUESTION_ORDER_STALE_ERROR,
  baseQuestionSchema,
  reorderIdsSchema,
  validateOptions,
  validateShortAnswerFormat,
} from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { isSameIdSet } from '@/lib/utils';

const createSchema = baseQuestionSchema
  .superRefine(validateOptions)
  .superRefine(validateShortAnswerFormat);

const updateSchema = baseQuestionSchema
  .extend({ id: z.string().min(1, 'ID is required') })
  .superRefine(validateOptions)
  .superRefine(validateShortAnswerFormat);

const deleteSchema = z.object({ id: z.string().min(1, 'ID is required') });

const reorderSchema = z.object({ ids: reorderIdsSchema });

type ActionError = { error: string };

export async function createGlobalQuestion(
  input: unknown,
): Promise<ActionError | void> {
  const user = await requireAdmin();

  const parsed = createSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { label, type, required, options, allowOther, format } = parsed.data;

  // Best-effort append; a concurrent insert can duplicate order, resolved by the read tiebreak.
  await prisma.$transaction(async (tx) => {
    const aggregate = await tx.globalQuestion.aggregate({
      where: { deletedAt: null },
      _max: { order: true },
    });
    const maxOrder = aggregate._max.order ?? 0;

    await tx.globalQuestion.create({
      data: {
        label,
        type,
        required,
        options,
        allowOther,
        format,
        order: maxOrder + 1,
        createdById: user.id,
        updatedById: user.id,
      },
    });
  });

  revalidatePath('/global-questions');
  revalidatePath('/profile');
}

export async function updateGlobalQuestion(
  input: unknown,
): Promise<ActionError | void> {
  const user = await requireAdmin();

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { id, label, type, required, options, allowOther, format } =
    parsed.data;

  const question = await prisma.globalQuestion.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!question) return { error: 'This question no longer exists.' };

  await prisma.globalQuestion.update({
    where: { id },
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

  revalidatePath('/global-questions');
  revalidatePath('/profile');
}

export async function deleteGlobalQuestion(
  input: unknown,
): Promise<ActionError | void> {
  const user = await requireAdmin();

  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { id } = parsed.data;

  const question = await prisma.globalQuestion.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!question) return { error: 'This question no longer exists.' };

  await prisma.globalQuestion.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  revalidatePath('/global-questions');
  revalidatePath('/profile');
}

export async function reorderGlobalQuestions(
  input: unknown,
): Promise<ActionError | void> {
  const user = await requireAdmin();

  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { ids } = parsed.data;

  const live = await prisma.globalQuestion.findMany({
    where: { deletedAt: null },
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
      prisma.globalQuestion.update({
        where: { id },
        data: { order: index + 1, updatedById: user.id },
      }),
    ),
  );

  revalidatePath('/global-questions');
  revalidatePath('/profile');
}
