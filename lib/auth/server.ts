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
    // Soft-deleted rows still hold their email/neonAuthId (unique, not partial),
    // so re-signup collides with P2002 — not user-actionable, so throw generic.
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

// React.cache deduplicates calls within a single server render pass,
// avoiding a redundant DB round-trip when layout and page both call getCurrentUser().
export const getCurrentUser = cache(async function getCurrentUser() {
  const user = await getOptionalUser();
  if (user) return user;

  if (process.env.VERCEL_ENV !== 'production') redirect('/login/bypass');
  redirect('/login');
});

// Name gate — every personalized, authenticated surface must redirect a
// nameless user to /login to complete their name before rendering (#240).
// Deliberately NOT folded into getCurrentUser: the setUserName server action
// also calls getCurrentUser to resolve the caller, and would redirect itself
// away before it could ever write the name. Called by each gated route
// individually instead — app/(main)/(auth)/layout.tsx (covers applications,
// global-questions, my-applications, positions/[id]/apply|edit, users),
// app/(main)/page.tsx, and app/(main)/profile/page.tsx. Routes meant to stay
// reachable without a name — /positions, /positions/[id] — must not call
// this. Carries the requested path (set by proxy.ts on the `x-current-path`
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
