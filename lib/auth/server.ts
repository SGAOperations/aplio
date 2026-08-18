import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import type { User } from '@/prisma/client';

import { auth } from '@/lib/auth/config';
import { withRedirectTo } from '@/lib/auth/redirect';
import { LOGIN_DEACTIVATED_REASON } from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { isBypassAllowed } from '@/lib/utils';

type UserResolution =
  | { status: 'active'; user: User }
  | { status: 'deactivated' }
  | { status: 'anonymous' };

// Better Auth owns the User row, so the session id is the row id — no provisioning
// step and no second identity to keep in sync. Cached, so layout and page
// share one round-trip per render pass.
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
            ? { status: 'deactivated' }
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
      ? { status: 'deactivated' }
      : { status: 'active', user: row };
  },
);

export async function getIsBypass(): Promise<boolean> {
  if (!isBypassAllowed()) return false;
  return Boolean((await cookies()).get('dev-bypass-user-id')?.value);
}

// For public pages: personalizes if signed in, never forces auth; still
// provisions. Treats a deactivated caller as anonymous — getCurrentUser is
// the one that routes them to the deactivation notice.
export const getOptionalUser = cache(
  async function getOptionalUser(): Promise<User | null> {
    const resolution = await resolveUser();
    return resolution.status === 'active' ? resolution.user : null;
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

    if (resolution.status === 'deactivated') {
      const loginUrl = withRedirectTo('/login', await currentPath());
      const separator = loginUrl.includes('?') ? '&' : '?';
      redirect(`${loginUrl}${separator}reason=${LOGIN_DEACTIVATED_REASON}`);
    }

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
