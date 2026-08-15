'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { BYPASS_USERS, type BypassRole } from '@/lib/bypass-users';
import { prisma } from '@/lib/prisma';
import { isBypassAllowed } from '@/lib/utils';

// Well-known id, so concurrent bypass logins upsert one row instead of racing.
const BYPASS_POSITION_ID = 'bypass-position';

// Hard no-op unless isBypassAllowed() says otherwise.
export async function loginAsBypassUser(role: BypassRole) {
  if (!isBypassAllowed()) return;

  const cookieStore = await cookies();

  const config = BYPASS_USERS[role];
  if (!config) return;

  const { email, neonAuthId, isAdmin } = config;

  const user = await prisma.user.upsert({
    where: { neonAuthId },
    update: { email, isAdmin },
    create: { email, neonAuthId, isAdmin },
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

  redirect('/');
}

// Hard no-op unless isBypassAllowed() says otherwise.
export async function logoutBypassUser() {
  if (!isBypassAllowed()) return;

  const cookieStore = await cookies();
  cookieStore.delete('dev-bypass-user-id');

  redirect('/login/bypass');
}
