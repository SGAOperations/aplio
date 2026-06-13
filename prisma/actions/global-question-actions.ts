'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod/v4';

import { getCurrentUser } from '@/lib/auth/server';
import prisma from '@/lib/prisma';

const questionTypeValues = [
  'short_answer',
  'long_answer',
  'single_choice',
  'multiple_choice',
] as const;

const createSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  type: z.enum(questionTypeValues),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
});

const updateSchema = createSchema.extend({
  id: z.string().min(1, 'ID is required'),
});

const deleteSchema = z.object({ id: z.string().min(1, 'ID is required') });

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

  const aggregate = await prisma.globalQuestion.aggregate({
    where: { deletedAt: null },
    _max: { order: true },
  });
  const maxOrder = aggregate._max.order ?? 0;

  await prisma.globalQuestion.create({
    data: {
      label,
      type,
      required,
      options: options ?? [],
      order: maxOrder + 1,
      createdById: user.id,
      updatedById: user.id,
    },
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
    data: {
      label,
      type,
      required,
      options: options ?? [],
      updatedById: user.id,
    },
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
