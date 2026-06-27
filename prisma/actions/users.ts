'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod/v4';

import { authServer, getCurrentUser } from '@/lib/auth/server';
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

  // Bust all cached route segments so the affected user's gated layout re-runs
  // getCurrentUser() on their next navigation — not just the admin's /users page.
  revalidatePath('/', 'layout');
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

  // Single round-trip: update returns neonAuthId for the revocation step below.
  // P2025 (record not found) propagates as an unexpected throw — not reachable
  // from the freshly-rendered admin list where deletedAt was already null.
  const updated = await prisma.user.update({
    where: { id: userId, deletedAt: null },
    data: { deletedAt: new Date(), deletedById: user.id },
    select: { neonAuthId: true },
  });

  // Bust all cached route segments so the deactivated user's gated layout
  // re-runs getCurrentUser() on their next navigation.
  revalidatePath('/', 'layout');

  // Best-effort: revoke all Neon Auth sessions for the deactivated user so a
  // hard reload can't ride a live session either. Swallow on failure — the
  // revalidatePath + getCurrentUser block is the guaranteed enforcement.
  try {
    await authServer.admin.revokeUserSessions({ userId: updated.neonAuthId });
  } catch (err) {
    console.error('Session revocation failed for deactivated user:', err);
  }
}
