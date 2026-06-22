'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod/v4';

import { getCurrentUser } from '@/lib/auth/server';
import prisma from '@/lib/prisma';

// description is optional at the server boundary (defaults to '') to support creating
// draft positions quickly; the plan spec intended required but UI allows empty drafts.
const createPositionSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(''),
  status: z.enum(['draft', 'open', 'closed']),
  opensAt: z.string().optional(),
  closesAt: z.string().optional(),
});

const updatePositionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().default(''),
  status: z.enum(['draft', 'open', 'closed']),
  opensAt: z.string().optional(),
  closesAt: z.string().optional(),
});

const deletePositionSchema = z.object({ id: z.string().min(1) });

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
): Promise<{ id: string } | { error: string }> {
  const user = await getCurrentUser();
  if (!user.isAdmin) return { error: 'Unauthorized' };

  const parsed = createPositionSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { title, description, status, opensAt, closesAt } = parsed.data;

  const position = await prisma.position.create({
    data: {
      title,
      description,
      status,
      opensAt: opensAt ? new Date(opensAt) : null,
      closesAt: closesAt ? new Date(closesAt) : null,
      createdById: user.id,
      updatedById: user.id,
    },
    select: { id: true },
  });

  revalidatePath('/positions');
  return { id: position.id };
}

export async function updatePosition(
  input: unknown,
): Promise<void | { error: string }> {
  const user = await getCurrentUser();

  const parsed = updatePositionSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { id, title, description, status, opensAt, closesAt } = parsed.data;

  const position = await prisma.position.findFirst({
    where: { id, deletedAt: null },
    include: { managers: { where: { id: user.id } } },
  });

  if (!position) return { error: 'Position not found' };

  const isManager = position.managers.length > 0;
  if (!user.isAdmin && !isManager) return { error: 'Unauthorized' };

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
}

export async function deletePosition(
  input: unknown,
): Promise<void | { error: string }> {
  const user = await getCurrentUser();
  if (!user.isAdmin) return { error: 'Unauthorized' };

  const parsed = deletePositionSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { id } = parsed.data;

  const deleteResult = await prisma.position.updateMany({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  if (deleteResult.count === 0) return { error: 'Not found' };

  revalidatePath('/positions');
}

export async function addPositionManager(
  input: unknown,
): Promise<void | { error: string }> {
  const user = await getCurrentUser();
  if (!user.isAdmin) return { error: 'Unauthorized' };

  const parsed = addPositionManagerSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { positionId, userId } = parsed.data;

  const addPosition = await prisma.position.findFirst({
    where: { id: positionId, deletedAt: null },
    select: { id: true },
  });
  if (!addPosition) return { error: 'Not found' };

  await prisma.position.update({
    where: { id: positionId },
    data: { managers: { connect: { id: userId } }, updatedById: user.id },
  });

  revalidatePath(`/positions/${positionId}/edit`);
}

export async function removePositionManager(
  input: unknown,
): Promise<void | { error: string }> {
  const user = await getCurrentUser();
  if (!user.isAdmin) return { error: 'Unauthorized' };

  const parsed = removePositionManagerSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { positionId, userId } = parsed.data;

  const removePosition = await prisma.position.findFirst({
    where: { id: positionId, deletedAt: null },
    select: { id: true },
  });
  if (!removePosition) return { error: 'Not found' };

  await prisma.position.update({
    where: { id: positionId },
    data: { managers: { disconnect: { id: userId } }, updatedById: user.id },
  });

  revalidatePath(`/positions/${positionId}/edit`);
}

const searchUsersSchema = z.object({ query: z.string().max(200) });

export async function searchUsers(input: unknown) {
  const user = await getCurrentUser();
  if (!user.isAdmin) return [];

  const parsed = searchUsersSchema.safeParse(input);
  if (!parsed.success) return [];

  const { query } = parsed.data;

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
