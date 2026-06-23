import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { getProfileCompleteness } from '@/prisma/data/profile';

import { getCurrentUser } from '@/lib/auth/server';
import prisma from '@/lib/prisma';

export default async function AuthGateLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();

  if (user.isAdmin) return <>{children}</>;

  const managedCount = await prisma.position.count({
    where: { managers: { some: { id: user.id } }, deletedAt: null },
  });
  if (managedCount > 0) return <>{children}</>;

  const { complete } = await getProfileCompleteness(user.id);
  if (!complete) redirect('/profile');

  return <>{children}</>;
}
