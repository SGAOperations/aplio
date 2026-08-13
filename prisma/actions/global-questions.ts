'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod/v4';

import { requireAdmin } from '@/lib/auth/guards';
import {
  baseQuestionSchema,
  validateOptions,
  validateShortAnswerFormat,
} from '@/lib/constants';
import { prisma } from '@/lib/prisma';

const createSchema = baseQuestionSchema
  .superRefine(validateOptions)
  .superRefine(validateShortAnswerFormat);

const updateSchema = baseQuestionSchema
  .extend({ id: z.string().min(1, 'ID is required') })
  .superRefine(validateOptions)
  .superRefine(validateShortAnswerFormat);

const deleteSchema = z.object({ id: z.string().min(1, 'ID is required') });

type ActionError = { error: string };

export async function createGlobalQuestion(
  input: unknown,
): Promise<ActionError | void> {
  const user = await requireAdmin();

  const parsed = createSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { label, type, required, options, allowOther, format } = parsed.data;

  // Aggregate and create run in a transaction to prevent duplicate order values
  // under concurrent inserts.
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
