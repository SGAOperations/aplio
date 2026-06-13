'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod/v4';

import { getCurrentUser } from '@/lib/auth/server';
import prisma from '@/lib/prisma';

const createPositionSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(''),
  status: z.enum(['draft', 'open', 'closed']),
});

const updatePositionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().default(''),
  status: z.enum(['draft', 'open', 'closed']),
  opensAt: z.string().optional(),
  closesAt: z.string().optional(),
});

const deletePositionSchema = z.object({
  id: z.string().min(1),
});

const addPositionManagerSchema = z.object({
  positionId: z.string().min(1),
  userId: z.string().min(1),
});

const removePositionManagerSchema = z.object({
  positionId: z.string().min(1),
  userId: z.string().min(1),
});

export async function createPosition(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user.isAdmin) return { ok: false, error: 'Unauthorized' };

  const parsed = createPositionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const { title, description, status } = parsed.data;

  await prisma.position.create({
    data: {
      title,
      description,
      status,
      createdById: user.id,
      updatedById: user.id,
    },
  });

  revalidatePath('/positions');
  return { ok: true };
}

export async function updatePosition(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();

  const parsed = updatePositionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const { id, title, description, status, opensAt, closesAt } = parsed.data;

  const position = await prisma.position.findFirst({
    where: { id, deletedAt: null },
    include: { managers: { where: { id: user.id } } },
  });

  if (!position) return { ok: false, error: 'Position not found' };

  const isManager = position.managers.length > 0;
  if (!user.isAdmin && !isManager) return { ok: false, error: 'Unauthorized' };

  await prisma.position.update({
    where: { id },
    data: {
      title,
      description,
      status,
      opensAt: opensAt ? new Date(opensAt) : null,
      closesAt: closesAt ? new Date(closesAt) : null,
      updatedById: user.id,
    },
  });

  revalidatePath('/positions');
  revalidatePath(`/positions/${id}`);
  revalidatePath(`/positions/${id}/edit`);
  return { ok: true };
}

export async function deletePosition(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user.isAdmin) return { ok: false, error: 'Unauthorized' };

  const parsed = deletePositionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  await prisma.position.delete({ where: { id: parsed.data.id } });

  revalidatePath('/positions');
  return { ok: true };
}

export async function addPositionManager(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user.isAdmin) return { ok: false, error: 'Unauthorized' };

  const parsed = addPositionManagerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const { positionId, userId } = parsed.data;

  await prisma.position.update({
    where: { id: positionId },
    data: {
      managers: { connect: { id: userId } },
      updatedById: user.id,
    },
  });

  revalidatePath(`/positions/${positionId}/edit`);
  return { ok: true };
}

export async function removePositionManager(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user.isAdmin) return { ok: false, error: 'Unauthorized' };

  const parsed = removePositionManagerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const { positionId, userId } = parsed.data;

  await prisma.position.update({
    where: { id: positionId },
    data: {
      managers: { disconnect: { id: userId } },
      updatedById: user.id,
    },
  });

  revalidatePath(`/positions/${positionId}/edit`);
  return { ok: true };
}

export async function searchUsers(query: string) {
  const user = await getCurrentUser();
  if (!user.isAdmin) return [];

  if (!query.trim()) return [];

  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, email: true },
    take: 10,
  });

  return users.map((u) => ({
    id: u.id,
    displayName: u.name ?? u.email,
    primaryEmail: u.email,
  }));
}
