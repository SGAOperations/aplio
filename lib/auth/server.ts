import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import type { User } from '@/prisma/client';

import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';

// Better Auth owns the User row, so the session id is the row id — no provisioning
// step and no second identity to keep in sync.
async function resolveRealUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const row = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!row || row.deletedAt) return null;
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
