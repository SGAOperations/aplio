import { createAuthServer } from '@neondatabase/auth/next/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import prisma from '@/lib/prisma';

export const authServer = createAuthServer();

// Resolve a real Neon Auth session to an active (non-deactivated) database user.
// Returns null when no valid session exists or the user is deactivated.
async function resolveRealUser() {
  const { data: session } = await authServer.getSession();
  if (!session?.user) return null;
  return prisma.user.findUnique({
    where: { neonAuthId: session.user.id, deletedAt: null },
  });
}

// Returns true only when a bypass cookie is present on a non-production environment.
// Extracted so layouts share a single definition; called after getCurrentUser() resolves.
export async function getIsBypass(): Promise<boolean> {
  if (process.env.VERCEL_ENV === 'production') return false;
  return Boolean((await cookies()).get('dev-bypass-user-id')?.value);
}

// Resolves to an active user without redirecting — used on the login page to
// decide whether to auto-forward. Returns null for unauthenticated, deactivated,
// or provisioning-gap users so the login form is shown instead of looping.
export const getOptionalUser = cache(async function getOptionalUser() {
  if (process.env.VERCEL_ENV !== 'production') {
    const bypassUserId = (await cookies()).get('dev-bypass-user-id')?.value;
    if (bypassUserId) {
      const user = await prisma.user.findUnique({
        where: { id: bypassUserId, deletedAt: null },
      });
      if (user) return user;
      // Deactivated or stale bypass cookie — fall through to real-auth check below.
    }
    return resolveRealUser();
  }
  return resolveRealUser();
});

// React.cache deduplicates calls within a single server render pass,
// avoiding a redundant DB round-trip when layout and page both call getCurrentUser().
// Pure read — no side effects (no signOut, no cookie mutations).
export const getCurrentUser = cache(async function getCurrentUser() {
  if (process.env.VERCEL_ENV !== 'production') {
    const bypassUserId = (await cookies()).get('dev-bypass-user-id')?.value;

    if (bypassUserId) {
      const user = await prisma.user.findUnique({
        where: { id: bypassUserId, deletedAt: null },
      });
      // Valid active bypass session — use it.
      if (user) return user;
      // Deactivated or stale bypass cookie — fall through to real auth.
    }

    const realUser = await resolveRealUser();
    if (realUser) return realUser;

    redirect('/login/bypass');
  }

  const realUser = await resolveRealUser();
  if (realUser) return realUser;

  redirect('/login');
});
