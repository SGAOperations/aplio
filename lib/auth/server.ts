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

// React.cache deduplicates calls within a single server render pass,
// avoiding a redundant DB round-trip when layout and page both call getCurrentUser().
export const getCurrentUser = cache(async function getCurrentUser() {
  if (process.env.VERCEL_ENV !== 'production') {
    const cookieStore = await cookies();
    const bypassUserId = cookieStore.get('dev-bypass-user-id')?.value;

    if (bypassUserId) {
      const user = await prisma.user.findUnique({
        where: { id: bypassUserId, deletedAt: null },
      });
      // Valid active bypass session — use it.
      if (user) return user;

      // Bypass cookie present but user is deactivated (deletedAt is set) — show
      // the deactivated page so the teardown island can clear the cookie.
      const deactivatedBypass = await prisma.user.findUnique({
        where: { id: bypassUserId },
      });
      if (deactivatedBypass?.deletedAt) redirect('/login/deactivated');

      // Stale/invalid bypass cookie — fall through to real auth.
    }

    const realUser = await resolveRealUser();
    if (realUser) return realUser;

    redirect('/login/bypass');
  }

  const realUser = await resolveRealUser();
  if (realUser) return realUser;

  // Real Neon Auth session but user is deactivated — show the deactivated page
  // so the teardown island can sign the user out of Neon Auth.
  const { data: session } = await authServer.getSession();
  if (session?.user) redirect('/login/deactivated');

  redirect('/login');
});
