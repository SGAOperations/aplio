'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { getOptionalUser } from '@/lib/auth/server';
import prisma from '@/lib/prisma';

export type BypassRole = 'admin' | 'applicant' | 'position-manager';

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

export async function loginAsBypassUser(role: BypassRole) {
  if (process.env.VERCEL_ENV === 'production') return;

  // If a bypass cookie is already present but getOptionalUser() returns null,
  // the session belongs to a deactivated user. Do not reset the cookie — redirect
  // to /login so the loop is broken (the stale cookie remains but is never refreshed).
  const cookieStore = await cookies();
  const existingBypassId = cookieStore.get('dev-bypass-user-id')?.value;
  if (existingBypassId) {
    const currentUser = await getOptionalUser();
    if (!currentUser) redirect('/login');
  }

  const config = BYPASS_USERS[role];
  if (!config) return;

  const { email, neonAuthId, isAdmin } = config;

  const user = await prisma.user.upsert({
    where: { neonAuthId },
    update: { email, isAdmin },
    create: { email, neonAuthId, isAdmin },
  });

  if (role === 'position-manager') {
    const existingPosition = await prisma.position.findFirst({
      where: { title: 'Bypass Position' },
    });

    if (existingPosition) {
      await prisma.position.update({
        where: { id: existingPosition.id },
        data: { managers: { connect: { id: user.id } } },
      });
    } else {
      await prisma.position.create({
        data: {
          title: 'Bypass Position',
          description: 'A position for bypass testing.',
          status: 'open',
          createdById: user.id,
          updatedById: user.id,
          managers: { connect: { id: user.id } },
        },
      });
    }
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
// Hard no-op in production — the cookie and this action are dev-only (ENGINEERING §3).
export async function logoutBypassUser() {
  if (process.env.VERCEL_ENV === 'production') return;

  const cookieStore = await cookies();
  cookieStore.delete('dev-bypass-user-id');

  redirect('/login/bypass');
}
