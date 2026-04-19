import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { authServer } from '@/lib/auth/server';
import prisma from '@/lib/prisma';

interface ProtectedLayoutProps {
  children: ReactNode;
}

export default async function ProtectedLayout({
  children,
}: ProtectedLayoutProps) {
  const { data: session } = await authServer.getSession();
  if (!session?.user) redirect('/handler/sign-in');

  const dbUser = await prisma.user.findUnique({
    where: { neonAuthId: session.user.id },
    select: {
      id: true,
      isAdmin: true,
      managedPositions: { select: { id: true }, take: 1 },
    },
  });
  if (!dbUser) redirect('/handler/sign-in');

  const isExempt = dbUser.isAdmin || dbUser.managedPositions.length > 0;

  if (!isExempt) {
    const [requiredCount, answeredCount] = await Promise.all([
      prisma.globalQuestion.count({
        where: { required: true, deletedAt: null },
      }),
      prisma.globalAnswer.count({
        where: { userId: dbUser.id, deletedAt: null },
      }),
    ]);

    if (answeredCount < requiredCount) redirect('/profile');
  }

  return <>{children}</>;
}
