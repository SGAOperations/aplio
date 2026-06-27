import { createAuthServer } from '@neondatabase/auth/next/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import type { Prisma } from '@/prisma/client';

import { prisma } from '@/lib/prisma';

export const authServer = createAuthServer();

// Shared upsert used by both provision-on-first-auth and the admin createUser action.
// Create-only (empty update {}) so an existing row is returned without any write
// on sign-in. Keyed on neonAuthId — race-safe via the DB unique constraint.
// name omitted when falsy (OTP identities often supply an empty string → store null).
// Accepts an optional Prisma transaction client so callers inside $transaction can
// share the same unit of work without duplicating the upsert definition.
export async function upsertAppUser(
  {
    neonAuthId,
    email,
    name,
  }: { neonAuthId: string; email: string; name?: string | null },
  createdById?: string,
  tx?: Prisma.TransactionClient,
) {
  const client = tx ?? prisma;
  return client.user.upsert({
    where: { neonAuthId },
    update: {},
    create: {
      neonAuthId,
      email,
      ...(name ? { name } : {}),
      isAdmin: false,
      ...(createdById ? { createdById } : {}),
    },
  });
}

// Provision-on-first-auth: create the app User row when a real Neon session
// has no matching row yet, then return it.
// Deactivated users (#153) are blocked by the post-upsert guard below.
async function resolveRealUser() {
  const { data: session } = await authServer.getSession();
  if (!session?.user) return null;

  const { id: neonAuthId, email, name } = session.user;

  const row = await upsertAppUser({ neonAuthId, email, name });
  if (row.deletedAt) return null;
  return row;
}

// Returns true only when a bypass cookie is present on a non-production environment.
// Extracted so layouts share a single definition; called after getCurrentUser() resolves.
export async function getIsBypass(): Promise<boolean> {
  if (process.env.VERCEL_ENV === 'production') return false;
  return Boolean((await cookies()).get('dev-bypass-user-id')?.value);
}

// Like getCurrentUser, but returns null instead of redirecting when no user is
// resolved. For PUBLIC pages that optionally personalize for a logged-in visitor
// (e.g. /positions) without forcing authentication. Provisioning still runs for a
// real session via resolveRealUser, so a logged-in visitor always has an app row.
export const getOptionalUser = cache(async function getOptionalUser() {
  if (process.env.VERCEL_ENV !== 'production') {
    const bypassUserId = (await cookies()).get('dev-bypass-user-id')?.value;
    if (bypassUserId) {
      const user = await prisma.user.findUnique({
        where: { id: bypassUserId, deletedAt: null },
      });
      if (user) return user;
    }
  }
  return resolveRealUser(); // null when no session; provisions when there is one
});

// React.cache deduplicates calls within a single server render pass,
// avoiding a redundant DB round-trip when layout and page both call getCurrentUser().
export const getCurrentUser = cache(async function getCurrentUser() {
  const user = await getOptionalUser();
  if (user) return user;

  if (process.env.VERCEL_ENV !== 'production') redirect('/login/bypass');
  redirect('/login');
});
