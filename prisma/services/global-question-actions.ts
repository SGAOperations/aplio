'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod/v4';

import { getCurrentUser } from '@/lib/auth/server';
import prisma from '@/lib/prisma';

import { QUESTION_TYPE_VALUES } from './global-question-constants';

const CHOICE_TYPES = ['single_choice', 'multiple_choice'] as const;

const createSchema = z
  .object({
    label: z.string().min(1, 'Label is required'),
    type: z.enum(QUESTION_TYPE_VALUES),
    required: z.boolean(),
    options: z.array(z.string()),
  })
  .superRefine((data, ctx) => {
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

const updateSchema = createSchema.extend({
  id: z.string().min(1, 'ID is required'),
});

const deleteSchema = z.object({ id: z.string().min(1, 'ID is required') });

const reorderSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  direction: z.enum(['up', 'down']),
});

type ActionResult = { ok: true } | { ok: false; error: string };

export async function createGlobalQuestion(
  input: unknown,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.isAdmin) return { ok: false, error: 'Forbidden' };

  const parsed = createSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };

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
        options: options,
        order: maxOrder + 1,
        createdById: user.id,
        updatedById: user.id,
      },
    });
  });

  revalidatePath('/global-questions');
  revalidatePath('/profile');
  return { ok: true };
}

export async function updateGlobalQuestion(
  input: unknown,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.isAdmin) return { ok: false, error: 'Forbidden' };

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };

  const { id, label, type, required, options } = parsed.data;

  const question = await prisma.globalQuestion.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!question) return { ok: false, error: 'Not found' };

  await prisma.globalQuestion.update({
    where: { id },
    data: { label, type, required, options: options, updatedById: user.id },
  });

  revalidatePath('/global-questions');
  revalidatePath('/profile');
  return { ok: true };
}

export async function deleteGlobalQuestion(
  input: unknown,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.isAdmin) return { ok: false, error: 'Forbidden' };

  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const { id } = parsed.data;

  const question = await prisma.globalQuestion.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!question) return { ok: false, error: 'Not found' };

  await prisma.globalQuestion.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  revalidatePath('/global-questions');
  revalidatePath('/profile');
  return { ok: true };
}

export async function reorderGlobalQuestion(
  input: unknown,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.isAdmin) return { ok: false, error: 'Forbidden' };

  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const { id, direction } = parsed.data;

  // Swap the order values of the target question and its neighbour in a
  // transaction to keep order values consistent under concurrent moves.
  await prisma.$transaction(async (tx) => {
    const target = await tx.globalQuestion.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, order: true },
    });
    if (!target) return;

    const neighbour = await tx.globalQuestion.findFirst({
      where: {
        deletedAt: null,
        order: direction === 'up' ? { lt: target.order } : { gt: target.order },
      },
      select: { id: true, order: true },
      orderBy: { order: direction === 'up' ? 'desc' : 'asc' },
    });
    if (!neighbour) return;

    await tx.globalQuestion.update({
      where: { id: target.id },
      data: { order: neighbour.order, updatedById: user.id },
    });
    await tx.globalQuestion.update({
      where: { id: neighbour.id },
      data: { order: target.order, updatedById: user.id },
    });
  });

  revalidatePath('/global-questions');
  revalidatePath('/profile');
  return { ok: true };
}
