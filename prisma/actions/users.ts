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

// Type guard for Better Auth error responses — avoids unsafe `as` casts.
function hasCode(e: unknown): e is { code: string } {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    typeof (e as Record<string, unknown>).code === 'string'
  );
}

export async function createUser(input: unknown): Promise<ActionError | void> {
  const admin = await getCurrentUser();
  if (!admin.isAdmin) return { error: 'Unauthorized' };

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { email, name, isAdmin } = parsed.data;

  // Pre-create the Neon Auth account so the user can sign in via OTP immediately.
  // A random password satisfies the required field; OTP is the actual sign-in method.
  const authResult = await authServer.admin.createUser({
    email,
    name: name?.trim() ?? '',
    password: crypto.randomUUID() + crypto.randomUUID(),
  });

  if (authResult.error) {
    if (
      hasCode(authResult.error) &&
      (authResult.error.code === 'USER_ALREADY_EXISTS' ||
        authResult.error.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL')
    )
      return { error: 'A user with this email already exists.' };
    throw new Error(`Neon Auth createUser failed: ${String(authResult.error)}`);
  }

  if (!authResult.data?.user.id)
    throw new Error('Neon Auth createUser returned no user id');

  const neonAuthId = authResult.data.user.id;

  await prisma.user.create({
    data: {
      neonAuthId,
      email,
      ...(name?.trim() ? { name: name.trim() } : {}),
      isAdmin: isAdmin ?? false,
      createdById: admin.id,
    },
  });

  revalidatePath('/users');
}
