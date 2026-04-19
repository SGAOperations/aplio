import { createAuthServer } from '@neondatabase/auth/next/server';
import { redirect } from 'next/navigation';

import prisma from '@/lib/prisma';

export const authServer = createAuthServer();

export async function getCurrentUser() {
  const { data: session } = await authServer.getSession();
  if (!session?.user) redirect('/auth/login');
  return prisma.user.upsert({
    where: { neonAuthId: session.user.id },
    update: {},
    create: {
      neonAuthId: session.user.id,
      email: session.user.email,
      name: session.user.name ?? null,
    },
  });
}
