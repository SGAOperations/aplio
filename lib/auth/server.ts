import { createAuthServer } from '@neondatabase/auth/next/server';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import type { User } from '@/prisma/client';
import { Prisma } from '@/prisma/client';

import { prisma } from '@/lib/prisma';

export const authServer = createAuthServer();

// Provision-on-first-auth: empty update {} makes it create-only; neonAuthId keeps it race-safe.
async function resolveRealUser() {
  const { data: session } = await authServer.getSession();
  if (!session?.user) return null;

  const { id: neonAuthId, email, name } = session.user;

  let row;
  try {
    row = await prisma.user.upsert({
      where: { neonAuthId },
      update: {},
      create: { neonAuthId, email, ...(name ? { name } : {}), isAdmin: false },
    });
  } catch (error) {
    // Soft-deleted rows keep their email, so re-signup hits P2002.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw new Error(
        'Unable to sign in — this account could not be provisioned.',
      );
    throw error;
  }
  if (row.deletedAt) return null;
  return row;
}

export async function getIsBypass(): Promise<boolean> {
  if (process.env.VERCEL_ENV === 'production') return false;
  return Boolean((await cookies()).get('dev-bypass-user-id')?.value);
}

// For public pages: personalizes if signed in, never forces auth; still provisions.
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

// Cached, so layout and page share one round-trip per render pass.
export const getCurrentUser = cache(async function getCurrentUser() {
  const user = await getOptionalUser();
  if (user) return user;

  if (process.env.VERCEL_ENV !== 'production') redirect('/login/bypass');
  redirect('/login');
});

// Public routes must guard with `if (user) await requireName(user)` — anonymous visitors bypass.
// Not folded into getCurrentUser: setUserName calls getCurrentUser too and would redirect before writing the name.
export async function requireName(user: Pick<User, 'name'>): Promise<void> {
  if (user.name?.trim()) return;
  const currentPath = (await headers()).get('x-current-path');
  const query = currentPath
    ? `?redirectTo=${encodeURIComponent(currentPath)}`
    : '';
  redirect(`/login${query}`);
}
