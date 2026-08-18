'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

import { auth } from '@/lib/auth/config';
import { getCurrentUser } from '@/lib/auth/server';
import {
  ACCOUNT_DEACTIVATED_MESSAGE,
  OTP_RESEND_COOLDOWN_SECONDS,
  signInEmailSchema,
} from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import type { ErrorType } from '@/lib/utils';

// No auth check: pre-auth surface, rate-limited by proxy.ts's public tier.
// Pre-send guard: sendVerificationOTP has no deletedAt check of its own.
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
  if (deactivated) return { error: ACCOUNT_DEACTIVATED_MESSAGE };
}

// Defense in depth: emailOtp's own rate limit is a 3-per-60s bucket, not a
// per-send cooldown, so a client with a tampered/skewed timer could still
// resend immediately. Reads the OTP row's own createdAt as the source of truth.
export async function isOtpResendAllowed(input: unknown): Promise<boolean> {
  const parsed = signInEmailSchema.safeParse(input);
  if (!parsed.success) return false;

  const latest = await prisma.verification.findFirst({
    where: { identifier: `sign-in-otp-${parsed.data.email.toLowerCase()}` },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (!latest) return true;

  const elapsedMs = Date.now() - latest.createdAt.getTime();
  return elapsedMs >= OTP_RESEND_COOLDOWN_SECONDS * 1000;
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
