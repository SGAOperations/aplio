'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod/v4';

import { authServer, getCurrentUser } from '@/lib/auth/server';
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

  // Generate a strong random password to satisfy the better-auth API.
  // The created user never uses this password — they sign in via email OTP.
  const password = `${crypto.randomUUID()}-${crypto.randomUUID()}`;

  const { data: authData, error: authError } =
    await authServer.admin.createUser({ email, name: name ?? '', password });

  if (authError) {
    // Duplicate email codes from the better-auth admin plugin.
    const code = (authError as { code?: string }).code;
    if (
      code === 'USER_ALREADY_EXISTS' ||
      code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'
    )
      return { error: 'A user with this email already exists.' };
    // Anything else is unexpected (network failure, auth config, etc.) → throw.
    throw new Error('Failed to create auth user');
  }

  if (!authData?.user?.id)
    throw new Error('Missing user ID from auth response');

  const neonAuthId = authData.user.id;

  await prisma.$transaction(async (tx) => {
    const appUser = await tx.user.upsert({
      where: { neonAuthId },
      update: {},
      create: {
        neonAuthId,
        email,
        ...(name ? { name } : {}),
        isAdmin: false,
        createdById: admin.id,
      },
    });

    if (isAdmin)
      await tx.user.update({
        where: { id: appUser.id },
        data: { isAdmin: true, updatedById: admin.id },
      });
  });

  revalidatePath('/users');
}
