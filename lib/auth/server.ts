import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import type { User } from '@/prisma/client';

import { auth } from '@/lib/auth/config';
import { withRedirectTo } from '@/lib/auth/redirect';
import { prisma } from '@/lib/prisma';
import { isBypassAllowed } from '@/lib/utils';

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
  if (!isBypassAllowed()) return false;
  return Boolean((await cookies()).get('dev-bypass-user-id')?.value);
}

// For public pages: personalizes if signed in, never forces auth; still provisions.
export const getOptionalUser = cache(async function getOptionalUser() {
  if (isBypassAllowed()) {
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

export async function currentPath(): Promise<string | null> {
  return (await headers()).get('x-current-path');
}

// Cached, so layout and page share one round-trip per render pass.
export const getCurrentUser = cache(async function getCurrentUser() {
  const user = await getOptionalUser();
  if (user) return user;

  const base = isBypassAllowed() ? '/login/bypass' : '/login';
  redirect(withRedirectTo(base, await currentPath()));
});

// Public routes must guard with `if (user) await requireName(user)` — anonymous visitors bypass.
// Not folded into getCurrentUser: setUserName calls getCurrentUser too and would redirect before writing the name.
export async function requireName(user: Pick<User, 'name'>): Promise<void> {
  if (user.name?.trim()) return;
  redirect(withRedirectTo('/login', await currentPath()));
}
