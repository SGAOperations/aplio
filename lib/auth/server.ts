import { createAuthServer } from '@neondatabase/auth/next/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { prisma } from '@/lib/prisma';

export const authServer = createAuthServer();

// Provision-on-first-auth: creates or links the app User row when a real Neon
// session has no matching row yet, then returns it.
// Pre-invited users (created by an admin before they sign up) are matched by
// email and linked to the session's neonAuthId on first login.
// Deactivated users (#153) are blocked by the post-lookup guard below.
async function resolveRealUser() {
  const { data: session } = await authServer.getSession();
  if (!session?.user) return null;

  const { id: neonAuthId, email, name } = session.user;

  // 1. Existing user already linked by neonAuthId
  let row = await prisma.user.findUnique({ where: { neonAuthId } });

  // 2. Pre-invited user — match by email, link neonAuthId on first sign-in
  if (!row) {
    const pending = await prisma.user.findFirst({
      where: { email, neonAuthId: null },
    });
    if (pending) {
      row = await prisma.user.update({
        where: { id: pending.id },
        data: { neonAuthId, ...(name?.trim() ? { name: name.trim() } : {}) },
      });
    }
  }

  // 3. Brand-new user — create app row
  if (!row) {
    row = await prisma.user.create({
      data: {
        neonAuthId,
        email,
        ...(name?.trim() ? { name: name.trim() } : {}),
        isAdmin: false,
      },
    });
  }

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
