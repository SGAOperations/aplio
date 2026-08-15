'use server';

import { revalidatePath } from 'next/cache';

import { authServer, getCurrentUser } from '@/lib/auth/server';
import { signInEmailSchema } from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import type { ErrorType } from '@/lib/utils';

// Must not redirect(): awaited from an event handler, so it would look like a failure.
export async function signOutUser(): Promise<ErrorType | void> {
  await getCurrentUser();

  const result = await authServer.signOut();

  if (result.error) {
    // The upstream cause is invisible to the browser, so log it here.
    console.error('signOutUser: authServer.signOut() failed', result.error);
    return { error: 'Could not sign out. Please try again.' };
  }

  revalidatePath('/', 'layout');
}

// No auth check: pre-auth surface, rate-limited by middleware's public tier.
export async function checkSignInAllowed(
  input: unknown,
): Promise<ErrorType | void> {
  const parsed = signInEmailSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  // Case-insensitive: emails aren't normalized on write.
  const deactivated = await prisma.user.findFirst({
    where: {
      email: { equals: parsed.data.email, mode: 'insensitive' },
      deletedAt: { not: null },
    },
    select: { id: true },
  });
  if (deactivated)
    return {
      error:
        'Your account has been deactivated. Please contact an administrator.',
    };
}
