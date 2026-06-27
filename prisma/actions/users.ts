'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod/v4';

import { authServer, getCurrentUser, upsertAppUser } from '@/lib/auth/server';
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

  // The admin plugin may not be enabled — guard before calling to surface a
  // user-facing message instead of an unhandled property-access throw.
  if (!authServer.admin?.createUser)
    return { error: 'User creation is not available.' };

  // Generate a strong random password to satisfy the better-auth API.
  // The created user never uses this password — they sign in via email OTP.
  const password = `${crypto.randomUUID()}-${crypto.randomUUID()}`;

  let authData: { user?: { id?: string } } | null | undefined;
  try {
    const result = await authServer.admin.createUser({
      email,
      name: name ?? '',
      password,
    });

    if (result.error) {
      // Duplicate email codes from the better-auth admin plugin.
      if (
        hasCode(result.error) &&
        (result.error.code === 'USER_ALREADY_EXISTS' ||
          result.error.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL')
      )
        return { error: 'A user with this email already exists.' };
      // Other known error — log context, then throw so the dialog shows a generic toast.
      console.error(
        '[createUser] auth backend rejected user creation:',
        result.error,
      );
      throw new Error('Failed to create auth user');
    }

    authData = result.data;
  } catch (err) {
    // Re-throw errors we already threw above; wrap unexpected throws from the SDK.
    if (err instanceof Error && err.message === 'Failed to create auth user')
      throw err;
    console.error(
      '[createUser] unexpected error from authServer.admin.createUser:',
      err,
    );
    throw new Error('Failed to create auth user');
  }

  if (!authData?.user?.id)
    throw new Error('Missing user ID from auth response');

  const neonAuthId = authData.user.id;

  await prisma.$transaction(async (tx) => {
    const appUser = await upsertAppUser(
      { neonAuthId, email, name },
      admin.id,
      tx,
    );

    if (isAdmin)
      await tx.user.update({
        where: { id: appUser.id },
        data: { isAdmin: true, updatedById: admin.id },
      });
  });

  revalidatePath('/users');
}
