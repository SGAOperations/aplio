'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { z } from 'zod';

import { safeRedirectTo } from '@/lib/auth/redirect';
import {
  BYPASS_ROLES,
  BYPASS_USERS,
  type BypassRole,
} from '@/lib/bypass-users';
import { prisma } from '@/lib/prisma';
import { isBypassAllowed } from '@/lib/utils';

// Well-known id, so concurrent bypass logins upsert one row instead of racing.
const BYPASS_POSITION_ID = 'bypass-position';

const roleSchema = z.enum(BYPASS_ROLES);

// Hard no-op unless isBypassAllowed() says otherwise.
export async function loginAsBypassUser(role: BypassRole, redirectTo?: string) {
  if (!isBypassAllowed()) return;

  const parsedRole = roleSchema.safeParse(role);
  if (!parsedRole.success) return;

  const cookieStore = await cookies();

  const { email, isAdmin, name } = BYPASS_USERS[parsedRole.data];

  const user = await prisma.user.upsert({
    where: { email },
    update: { isAdmin, name },
    create: { email, isAdmin, name },
  });

  if (role === 'position-manager') {
    await prisma.position.upsert({
      where: { id: BYPASS_POSITION_ID },
      update: { managers: { connect: { id: user.id } } },
      create: {
        id: BYPASS_POSITION_ID,
        title: 'Bypass Position',
        description: 'A position for bypass testing.',
        status: 'open',
        createdById: user.id,
        updatedById: user.id,
        managers: { connect: { id: user.id } },
      },
    });
  }

  cookieStore.set('dev-bypass-user-id', user.id, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
  });

  redirect(safeRedirectTo(redirectTo));
}

// Hard no-op unless isBypassAllowed() says otherwise.
export async function logoutBypassUser() {
  if (!isBypassAllowed()) return;

  const cookieStore = await cookies();
  cookieStore.delete('dev-bypass-user-id');

  redirect('/login/bypass');
}
