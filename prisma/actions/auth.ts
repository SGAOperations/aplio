'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

import { z } from 'zod/v4';

import { auth } from '@/lib/auth/config';
import { getCurrentUser } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';
import type { ErrorType } from '@/lib/utils';

const checkSignInAllowedSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

// No auth check: pre-auth surface, rate-limited by proxy.ts's public tier.
// sendVerificationOTP runs detached — a throw there never reaches the client.
export async function checkSignInAllowed(
  input: unknown,
): Promise<ErrorType | void> {
  const parsed = checkSignInAllowedSchema.safeParse(input);
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

// Must not redirect(): awaited from an event handler, so it would look like a failure.
export async function signOutUser(): Promise<ErrorType | void> {
  await getCurrentUser();

  try {
    await auth.api.signOut({ headers: await headers() });
  } catch (error) {
    // The upstream cause is invisible to the browser, so log it here.
    console.error('signOutUser: signOut failed', error);
    return { error: 'Could not sign out. Please try again.' };
  }

  revalidatePath('/', 'layout');
}
