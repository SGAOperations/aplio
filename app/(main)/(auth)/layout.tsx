import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

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

  const requiredQuestions = await prisma.globalQuestion.findMany({
    where: { required: true, deletedAt: null },
    select: { id: true },
  });

  if (requiredQuestions.length > 0) {
    const answers = await prisma.globalAnswer.findMany({
      where: {
        userId: user.id,
        globalQuestionId: { in: requiredQuestions.map((q) => q.id) },
        deletedAt: null,
      },
      select: { id: true },
    });
    if (answers.length < requiredQuestions.length) redirect('/profile');
  }

  return <>{children}</>;
}
