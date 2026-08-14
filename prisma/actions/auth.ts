'use server';

import { revalidatePath } from 'next/cache';

import { createNeonAuthUser } from '@/lib/auth/admin';
import { authServer, getCurrentUser } from '@/lib/auth/server';
import { AUTH_NAME_PLACEHOLDER, signInEmailSchema } from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import type { ErrorType, ResponseType } from '@/lib/utils';

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

// Provisions the Neon Auth identity for an email before the OTP is requested,
// since Neon silently skips its send.otp webhook for unrecognized addresses.
//
// No auth check: pre-auth surface reached only from the /login email step,
// rate-limited by the middleware's stricter `public` tier.
export async function ensureAuthUser(
  input: unknown,
): Promise<ResponseType<{ email: string }>> {
  const parsed = signInEmailSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  // Normalized once and reused so the lookup and the Neon call can't diverge.
  const normalizedEmail = parsed.data.email.toLowerCase();

  // Case-insensitive: emails aren't normalized on write, so this is the only
  // way to catch a deactivated user across capitalization changes.
  const deactivated = await prisma.user.findFirst({
    where: {
      email: { equals: normalizedEmail, mode: 'insensitive' },
      deletedAt: { not: null },
    },
    select: { id: true },
  });
  if (deactivated)
    return {
      error:
        'Your account has been deactivated. Please contact an administrator.',
    };

  // { duplicate: true } is the common case and treated as success, so the
  // response never reveals whether the row already existed.
  await createNeonAuthUser({
    email: normalizedEmail,
    name: AUTH_NAME_PLACEHOLDER,
  });

  // No revalidatePath: nothing rendered depends on the Neon Auth directory.
  return { email: normalizedEmail };
}
