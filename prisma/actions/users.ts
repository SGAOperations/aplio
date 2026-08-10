'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod/v4';

import { Prisma } from '@/prisma/client';

import { createNeonAuthUser, deleteNeonAuthUser } from '@/lib/auth/admin';
import { getCurrentUser } from '@/lib/auth/server';
import { createUserSchema } from '@/lib/constants';
import { prisma } from '@/lib/prisma';

const toggleAdminSchema = z.object({
  userId: z.string().min(1),
  makeAdmin: z.boolean(),
});

const deactivateSchema = z.object({ userId: z.string().min(1) });

type ActionError = { error: string };

export async function toggleUserAdmin(
  input: unknown,
): Promise<ActionError | void> {
  const user = await getCurrentUser();
  if (!user.isAdmin) return { error: 'Unauthorized' };

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
  const user = await getCurrentUser();
  if (!user.isAdmin) return { error: 'Unauthorized' };

  const parsed = deactivateSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { userId } = parsed.data;

  // An admin cannot deactivate their own account — defense in depth beyond the UI guard.
  if (userId === user.id)
    return { error: 'You cannot deactivate your own account.' };

  // Leaves email/neonAuthId intact, so neither is freed for reuse by a new signup.
  const result = await prisma.user.updateMany({
    where: { id: userId, deletedAt: null },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  // Not reachable from the freshly-rendered admin list → unexpected → throw.
  if (result.count === 0)
    throw new Error('User not found or already deactivated');

  revalidatePath('/users');
}

export async function createUser(input: unknown): Promise<ActionError | void> {
  const admin = await getCurrentUser();
  if (!admin.isAdmin) return { error: 'Unauthorized' };

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { email, name, isAdmin } = parsed.data;

  // Check our own table before calling Neon, so the common duplicate case is decided
  // deterministically rather than depending on a status code Neon does not document,
  // and no identity is provisioned only to be rolled back. Soft-deleted rows keep
  // their email (see deactivateUser above), so a deactivated address is still taken.
  // Racy by nature — the P2002 catch below is what actually guarantees uniqueness.
  const existing = await prisma.user.findFirst({
    where: { email },
    select: { id: true },
  });
  if (existing) return { error: 'A user with this email already exists.' };

  // Neon Auth identity next: the app row needs its id, and provisioning it is what
  // lets the invitee sign in via the normal OTP flow without ever having requested a
  // code. Uses the app's own credential, not the caller's session — see
  // lib/auth/admin.ts for why authServer.admin.createUser cannot work.
  const created = await createNeonAuthUser({ email, name });
  // Residual case only: present in Neon Auth but not in our table.
  if ('duplicate' in created)
    return { error: 'A user with this email already exists.' };

  try {
    await prisma.user.create({
      data: {
        neonAuthId: created.id,
        email,
        ...(name ? { name } : {}),
        isAdmin,
        createdById: admin.id,
      },
    });
  } catch (error) {
    // Any failure here leaves the identity orphaned in Neon Auth, so always roll it
    // back before surfacing — otherwise each retry accumulates another one.
    await deleteNeonAuthUser(created.id);

    // Soft-deleted rows keep their email and neonAuthId (unique, not partial — see
    // deactivateUser above), so a previously deactivated address collides here too.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      return { error: 'A user with this email already exists.' };

    throw error;
  }

  revalidatePath('/users');
}
