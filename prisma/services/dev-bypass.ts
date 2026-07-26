'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { isLocalEnvironment } from '@/lib/utils';

export type BypassRole = 'admin' | 'applicant' | 'position-manager';

// Well-known id so concurrent bypass logins upsert the same fixture row
// instead of racing to create duplicate "Bypass Position" rows.
const BYPASS_POSITION_ID = 'bypass-position';

const BYPASS_USERS: Record<
  BypassRole,
  { email: string; neonAuthId: string; isAdmin: boolean }
> = {
  admin: {
    email: 'bypass-admin@example.com',
    neonAuthId: 'bypass-admin',
    isAdmin: true,
  },
  applicant: {
    email: 'bypass-applicant@example.com',
    neonAuthId: 'bypass-applicant',
    isAdmin: false,
  },
  'position-manager': {
    email: 'bypass-position-manager@example.com',
    neonAuthId: 'bypass-position-manager',
    isAdmin: false,
  },
};

// Hard no-op outside local dev (ENGINEERING §3) — see isLocalEnvironment
// for why VERCEL_ENV, not NODE_ENV, is the right "are we local" signal.
export async function loginAsBypassUser(role: BypassRole) {
  if (!isLocalEnvironment()) return;

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

// Clears the bypass session cookie and returns the caller to the picker.
// Hard no-op outside local dev (ENGINEERING §3) — see isLocalEnvironment
// for why VERCEL_ENV, not NODE_ENV, is the right "are we local" signal.
export async function logoutBypassUser() {
  if (!isLocalEnvironment()) return;

  const cookieStore = await cookies();
  cookieStore.delete('dev-bypass-user-id');

  redirect('/login/bypass');
}
