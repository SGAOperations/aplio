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

// Name gate — every authenticated route under app/(main)/ redirects a
// nameless user to /login to complete their name before rendering. The only
// bypass is an anonymous visitor (getOptionalUser() -> null), which is what
// keeps /positions and /positions/[id] publicly browsable — callers there
// must guard with `if (user) await requireName(user)` rather than calling
// this unconditionally. Deliberately NOT folded into getCurrentUser: the
// setUserName server action also calls getCurrentUser to resolve the caller,
// and would redirect itself away before it could ever write the name.
// Carries the requested path (set by proxy.ts on the `x-current-path`
// header, since Server Components have no direct access to the request URL)
// so /login can route the user back to their original destination — e.g. an
// in-progress application — after they set their name, instead of dropping
// them at the generic listing.
export async function requireName(user: Pick<User, 'name'>): Promise<void> {
  if (user.name?.trim()) return;
  const currentPath = (await headers()).get('x-current-path');
  const query = currentPath
    ? `?redirectTo=${encodeURIComponent(currentPath)}`
    : '';
  redirect(`/login${query}`);
}
