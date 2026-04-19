import { createAuthServer } from '@neondatabase/auth/next/server';
import { redirect } from 'next/navigation';

import prisma from '@/lib/prisma';

export const authServer = createAuthServer();

export async function getCurrentUser() {
  const { data: session } = await authServer.getSession();
  if (!session?.user) redirect('/auth/login');

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ neonAuthId: session.user.id }, { email: session.user.email }],
    },
  });

  if (existing) {
    if (existing.neonAuthId !== session.user.id)
      return prisma.user.update({
        where: { id: existing.id },
        data: { neonAuthId: session.user.id },
      });
    return existing;
  }

  return prisma.user.create({
    data: {
      neonAuthId: session.user.id,
      email: session.user.email,
      name: session.user.name ?? null,
    },
  });
}
