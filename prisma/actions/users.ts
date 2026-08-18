'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod/v4';

import { Prisma } from '@/prisma/client';

import { requireAdmin } from '@/lib/auth/guards';
import { createUserSchema } from '@/lib/constants';
import { prisma } from '@/lib/prisma';

const toggleAdminSchema = z.object({
  userId: z.string().min(1),
  makeAdmin: z.boolean(),
});

const userIdSchema = z.object({ userId: z.string().min(1) });

type ActionError = { error: string };

export async function toggleUserAdmin(
  input: unknown,
): Promise<ActionError | void> {
  const user = await requireAdmin();

  const parsed = toggleAdminSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { userId, makeAdmin } = parsed.data;

  // An admin cannot change their own admin role — defense in depth beyond the UI guard.
  if (userId === user.id)
    return { error: 'You cannot change your own admin role.' };

  const result = await prisma.user.updateMany({
    where: { id: userId, deletedAt: null },
    data: { isAdmin: makeAdmin, updatedById: user.id },
  });

  // Not reachable from the freshly-rendered admin list → unexpected → throw.
  if (result.count === 0)
    throw new Error('User not found or already deactivated');

  revalidatePath('/users');
}

export async function deactivateUser(
  input: unknown,
): Promise<ActionError | void> {
  const user = await requireAdmin();

  const parsed = userIdSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { userId } = parsed.data;

  // An admin cannot deactivate their own account — defense in depth beyond the UI guard.
  if (userId === user.id)
    return { error: 'You cannot deactivate your own account.' };

  // Leaves the email intact, so it isn't freed for reuse by a new signup.
  await prisma.$transaction(async (tx) => {
    const result = await tx.user.updateMany({
      where: { id: userId, deletedAt: null },
      data: { deletedAt: new Date(), deletedById: user.id },
    });

    // Not reachable from the freshly-rendered admin list → unexpected → throw.
    if (result.count === 0)
      throw new Error('User not found or already deactivated');

    // Deletes rather than expires — reactivation can't resurrect a session
    // on a device the user no longer controls.
    await tx.session.deleteMany({ where: { userId } });
  });

  revalidatePath('/users');
}

// Caller is active by definition (getCurrentUser resolves only live rows), so
// they can never appear in the deactivated list — no self-reactivation guard needed.
export async function reactivateUser(
  input: unknown,
): Promise<ActionError | void> {
  const admin = await requireAdmin();

  const parsed = userIdSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { userId } = parsed.data;

  // Scoping to deletedAt: { not: null } makes a double-submit a no-op
  // instead of a spurious audit write.
  const result = await prisma.user.updateMany({
    where: { id: userId, deletedAt: { not: null } },
    data: { deletedAt: null, deletedById: null, updatedById: admin.id },
  });

  // Not reachable from the freshly-rendered deactivated list → unexpected → throw.
  if (result.count === 0) throw new Error('User not found or already active');

  revalidatePath('/users');
  revalidatePath('/users/deactivated');
}

export async function createUser(input: unknown): Promise<ActionError | void> {
  const admin = await requireAdmin();

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { email, name, isAdmin } = parsed.data;

  // Racy — the P2002 catch below is what actually guarantees uniqueness.
  const existing = await prisma.user.findFirst({
    where: { email },
    select: { id: true, deletedAt: true },
  });
  if (existing)
    return existing.deletedAt
      ? {
          error:
            'That email belongs to a deactivated account. Reactivate it from Users → Deactivated accounts.',
        }
      : { error: 'A user with this email already exists.' };

  // Verified in better-auth's sign-in/email-otp route: it matches this row
  // by exact email before ever inserting, so it's found here, never duplicated.
  try {
    await prisma.user.create({
      data: {
        email,
        ...(name ? { name } : {}),
        isAdmin,
        createdById: admin.id,
      },
    });
  } catch (error) {
    // Soft-deleted rows keep their email, so a deactivated address collides too.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      return { error: 'A user with this email already exists.' };

    throw error;
  }

  revalidatePath('/users');
}
