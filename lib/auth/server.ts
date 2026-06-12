import { createAuthServer } from '@neondatabase/auth/next/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import prisma from '@/lib/prisma';

export const authServer = createAuthServer();

export async function getCurrentUser() {
  if (process.env.VERCEL_ENV !== 'production') {
    const cookieStore = await cookies();
    const bypassUserId = cookieStore.get('dev-bypass-user-id')?.value;

    if (!bypassUserId) redirect('/login/bypass');

    const user = await prisma.user.findUnique({ where: { id: bypassUserId } });

    if (!user) redirect('/login/bypass');

    return user;
  }

  const { data: session } = await authServer.getSession();
  if (!session?.user) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { neonAuthId: session.user.id },
  });

  if (!user) redirect('/login');

  return user;
}
