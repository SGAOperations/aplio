import { createAuthServer } from '@neondatabase/auth/next/server';
import { redirect } from 'next/navigation';

import prisma from '@/lib/prisma';

export const authServer = createAuthServer();

export async function getCurrentUser() {
  const { data: session } = await authServer.getSession();
  if (!session?.user) redirect('/auth/login');

  const user = await prisma.user.findUnique({
    where: { neonAuthId: session.user.id },
  });

  if (!user) redirect('/auth/login');

  return user;
}
