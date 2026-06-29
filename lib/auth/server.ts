import { createAuthServer } from '@neondatabase/auth/next/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { Prisma } from '@/prisma/client';

import { prisma } from '@/lib/prisma';

export const authServer = createAuthServer();

// Provision-on-first-auth: find or create the app User row for the authenticated
// Neon session. Three-step lookup handles two cases:
//   1. Already linked — fast path via unique neonAuthId lookup.
//   2. Pre-invited — admin pre-created a row with email only; link neonAuthId on
//      first sign-in so subsequent requests hit the fast path.
//   3. Brand-new — create a fresh row; P2002 catch handles the concurrent sign-in
//      race (both requests pass steps 1–2 simultaneously and one wins create).
// name omitted when falsy (OTP identities often supply an empty string → store null).
// Deactivated users are blocked by the post-lookup guard below.
async function resolveRealUser() {
  const { data: session } = await authServer.getSession();
  if (!session?.user) return null;

  const { id: neonAuthId, email, name } = session.user;

  // 1. Already linked
  let row = await prisma.user.findUnique({ where: { neonAuthId } });

  // 2. Pre-invited by email — link neonAuthId on first sign-in
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

  // 3. Brand-new user — catch P2002 if two concurrent requests race to create
  if (!row) {
    try {
      row = await prisma.user.create({
        data: {
          neonAuthId,
          email,
          ...(name?.trim() ? { name: name.trim() } : {}),
          isAdmin: false,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        // Lost the race — the concurrent request created the row; fetch it
        row = await prisma.user.findUnique({ where: { neonAuthId } });
      } else {
        throw e;
      }
    }
  }

  if (!row || row.deletedAt) return null;
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
