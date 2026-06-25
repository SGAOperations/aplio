'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod/v4';

import { checkPositionAccess, isManager } from '@/prisma/data/managers';

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
  userId: z.string().cuid(),
});

const removePositionManagerSchema = z.object({
  positionId: z.string().min(1),
  userId: z.string().cuid(),
});

export async function createPosition(
  input: unknown,
): Promise<{ id: string } | { error: string }> {
  const user = await getCurrentUser();

  const allowed = user.isAdmin || (await isManager(user.id));
  if (!allowed) return { error: 'Unauthorized' };

  const parsed = createPositionSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { title, description, status, opensAt, closesAt } = parsed.data;

  // Creator is auto-assigned as a manager so they can immediately edit the position.
  const position = await prisma.position.create({
    data: {
      title,
      description,
      status,
      opensAt: opensAt ? new Date(opensAt) : null,
      closesAt: closesAt ? new Date(closesAt) : null,
      createdById: user.id,
      updatedById: user.id,
      managers: { connect: { id: user.id } },
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

  // Stale-link guard: a manager navigating to a deleted position should get an
  // actionable message, not a generic error toast (ENGINEERING §4 gray-area rule).
  const exists = await prisma.position.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!exists) return { error: 'Position no longer exists' };

  const hasAccess = await checkPositionAccess(id, user.id, user.isAdmin);
  if (!hasAccess) throw new Error('Forbidden');

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

  const parsed = addPositionManagerSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { positionId, userId } = parsed.data;

  const hasAccess = await checkPositionAccess(
    positionId,
    user.id,
    user.isAdmin,
  );
  if (!hasAccess) throw new Error('Forbidden');

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

  const parsed = removePositionManagerSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { positionId, userId } = parsed.data;

  const hasAccess = await checkPositionAccess(
    positionId,
    user.id,
    user.isAdmin,
  );
  if (!hasAccess) throw new Error('Forbidden');

  await prisma.position.update({
    where: { id: positionId },
    data: { managers: { disconnect: { id: userId } }, updatedById: user.id },
  });

  revalidatePath(`/positions/${positionId}/edit`);
}

const searchUsersSchema = z.object({ query: z.string().max(200) });

// Authenticated directory lookup used to assign position managers.
// Intentionally exposes name+email to any logged-in user — only id/displayName/email
// are returned (no sensitive/internal fields). Capped at 10 results.
export async function searchUsers(input: unknown) {
  // getCurrentUser redirects if unauthenticated; no further role check needed.
  await getCurrentUser();

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
