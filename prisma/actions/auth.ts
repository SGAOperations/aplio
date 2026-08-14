'use server';

import { revalidatePath } from 'next/cache';

import { createNeonAuthUser } from '@/lib/auth/admin';
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

// Provisions the Neon Auth identity for an email before the OTP is requested.
// Neon silently skips its `send.otp` webhook (and so its own email delivery)
// when the address has no existing Neon Auth user row — this is what makes
// that row exist first, so branded OTP email always fires (#437).
//
// Deliberately has NO auth check: this is a pre-auth surface, reachable only
// from the /login email step before any session exists. Its only inputs are
// a zod-validated email, it returns no data beyond a generic error, and the
// route is already rate-limited by the middleware's `public` tier (10/min/IP,
// stricter than the `api` tier the OTP send itself uses) — no change needed.
export async function ensureAuthUser(
  input: unknown,
): Promise<ErrorType | void> {
  const parsed = signInEmailSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  // Normalized once and reused below (for the lookup below and the Neon call)
  // so the two can never diverge in case: an active user typing a different
  // case than their original signup would otherwise reach createNeonAuthUser
  // with fresh casing and, if Neon's own dedup is case-sensitive, provision a
  // second identity for the same person instead of a clean no-op.
  const normalizedEmail = parsed.data.email.toLowerCase();

  // Case-insensitive: nothing in the codebase normalizes email case on write
  // (createUserSchema only trims), so an exact match would let a deactivated
  // user back in by changing capitalization. Soft-deleted rows deliberately
  // keep their email and neonAuthId (prisma/actions/users.ts), so this is the
  // only way to catch them before an identity is provisioned or an OTP sent.
  //
  // Prisma renders mode: 'insensitive' on Postgres as a
  // `LOWER(email) = LOWER($1)` comparison, which this PR's migration gives a
  // matching functional index on lower(email) — needed since this query runs
  // on every sign-in attempt, a genuinely hot path.
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

  // No name is available at this point — #240's post-auth name gate collects
  // it exactly as it does now. { duplicate: true } is the common case (every
  // existing user hits it on every sign-in) and is treated as success, so the
  // response is identical whether or not a row already existed — this
  // endpoint must stay non-enumerable, which it is today.
  await createNeonAuthUser({ email: normalizedEmail });

  // Deliberately no revalidatePath: nothing rendered by the app depends on
  // the Neon Auth directory, so there is nothing to invalidate.
}
