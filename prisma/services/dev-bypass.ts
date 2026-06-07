'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

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

  const cookieStore = await cookies();
  cookieStore.set('dev-bypass-user-id', user.id, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
  });

  redirect('/positions');
}
