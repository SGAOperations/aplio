'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod/v4';

import { getCurrentUser } from '@/lib/auth/server';
import { CHOICE_TYPES, baseQuestionSchema } from '@/lib/constants';
import prisma from '@/lib/prisma';

const createSchema = baseQuestionSchema.superRefine((data, ctx) => {
  // Choice-type questions must have at least one option.
  if (
    CHOICE_TYPES.includes(data.type as (typeof CHOICE_TYPES)[number]) &&
    data.options.length === 0
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['options'],
      message: 'At least one option is required for choice questions',
    });
  }
});

const updateSchema = baseQuestionSchema
  .extend({ id: z.string().min(1, 'ID is required') })
  .superRefine((data, ctx) => {
    if (
      CHOICE_TYPES.includes(data.type as (typeof CHOICE_TYPES)[number]) &&
      data.options.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'At least one option is required for choice questions',
      });
    }
  });

const deleteSchema = z.object({ id: z.string().min(1, 'ID is required') });

type ActionError = { error: string };

export async function createGlobalQuestion(
  input: unknown,
): Promise<ActionError | void> {
  const user = await getCurrentUser();
  if (!user.isAdmin) return { error: 'Forbidden' };

  const parsed = createSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { label, type, required, options } = parsed.data;

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
        order: maxOrder + 1,
        createdById: user.id,
        updatedById: user.id,
      },
    });
  });

  revalidatePath('/global-questions');
  // /profile will consume global questions once the profile route is built (#TODO).
  revalidatePath('/profile');
}

export async function updateGlobalQuestion(
  input: unknown,
): Promise<ActionError | void> {
  const user = await getCurrentUser();
  if (!user.isAdmin) return { error: 'Forbidden' };

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { id, label, type, required, options } = parsed.data;

  const question = await prisma.globalQuestion.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!question) return { error: 'Not found' };

  await prisma.globalQuestion.update({
    where: { id },
    data: { label, type, required, options, updatedById: user.id },
  });

  revalidatePath('/global-questions');
  // /profile will consume global questions once the profile route is built (#TODO).
  revalidatePath('/profile');
}

export async function deleteGlobalQuestion(
  input: unknown,
): Promise<ActionError | void> {
  const user = await getCurrentUser();
  if (!user.isAdmin) return { error: 'Forbidden' };

  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { id } = parsed.data;

  const question = await prisma.globalQuestion.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!question) return { error: 'Not found' };

  await prisma.globalQuestion.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  revalidatePath('/global-questions');
  // /profile will consume global questions once the profile route is built (#TODO).
  revalidatePath('/profile');
}
