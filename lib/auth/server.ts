import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import type { User } from '@/prisma/client';

import { auth } from '@/lib/auth/config';
import { withRedirectTo } from '@/lib/auth/redirect';
import { prisma } from '@/lib/prisma';
import { isBypassAllowed } from '@/lib/utils';

type UserResolution =
  | { status: 'active'; user: User }
  | { status: 'deactivated'; user: User }
  | { status: 'anonymous' };

// Better Auth owns the User row, so the session id is the row id.
const resolveUser = cache(
  async function resolveUser(): Promise<UserResolution> {
    if (isBypassAllowed()) {
      const bypassUserId = (await cookies()).get('dev-bypass-user-id')?.value;
      if (bypassUserId) {
        const row = await prisma.user.findUnique({
          where: { id: bypassUserId },
        });
        if (row)
          return row.deletedAt
            ? { status: 'deactivated', user: row }
            : { status: 'active', user: row };
      }
    }

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return { status: 'anonymous' };

    const row = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (!row) return { status: 'anonymous' };
    return row.deletedAt
      ? { status: 'deactivated', user: row }
      : { status: 'active', user: row };
  },
);

export async function getIsBypass(): Promise<boolean> {
  if (!isBypassAllowed()) return false;
  return Boolean((await cookies()).get('dev-bypass-user-id')?.value);
}

// Treats a deactivated caller as anonymous — getDeactivatedSessionUser is the
// one that routes it to the explanatory screen.
export const getOptionalUser = cache(
  async function getOptionalUser(): Promise<User | null> {
    const resolution = await resolveUser();
    return resolution.status === 'active' ? resolution.user : null;
  },
);

// A live session whose row has since been soft-deleted — distinct from "no
// session" so getCurrentUser avoids a silent sign-in loop.
export const getDeactivatedSessionUser = cache(
  async function getDeactivatedSessionUser(): Promise<User | null> {
    const resolution = await resolveUser();
    return resolution.status === 'deactivated' ? resolution.user : null;
  },
);

export async function currentPath(): Promise<string | null> {
  return (await headers()).get('x-current-path');
}

// Cached, so layout and page share one round-trip per render pass.
export const getCurrentUser = cache(
  async function getCurrentUser(): Promise<User> {
    const resolution = await resolveUser();
    if (resolution.status === 'active') return resolution.user;

    // Routing, not denial: a live session for a deactivated row goes to the
    // explanatory screen instead of silently bouncing back to /login forever.
    if (resolution.status === 'deactivated') redirect('/login/deactivated');

    const base = isBypassAllowed() ? '/login/bypass' : '/login';
    redirect(withRedirectTo(base, await currentPath()));
  },
);

// Public routes must guard with `if (user) await requireName(user)` — anonymous visitors bypass.
// Not folded into getCurrentUser: setUserName calls getCurrentUser too and would redirect before writing the name.
export async function requireName(user: Pick<User, 'name'>): Promise<void> {
  if (user.name?.trim()) return;
  redirect(withRedirectTo('/login', await currentPath()));
}
