'use server';

import { revalidatePath } from 'next/cache';

import { authServer } from '@/lib/auth/server';
import prisma from '@/lib/prisma';

export async function upsertGlobalAnswer(
  globalQuestionId: string,
  value: string[],
) {
  const { data: session } = await authServer.getSession();
  if (!session?.user) throw new Error('Unauthorized');

  const dbUser = await prisma.user.findUnique({
    where: { neonAuthId: session.user.id },
    select: { id: true },
  });
  if (!dbUser) throw new Error('User not found');

  await prisma.globalAnswer.upsert({
    where: { userId_globalQuestionId: { userId: dbUser.id, globalQuestionId } },
    create: {
      userId: dbUser.id,
      globalQuestionId,
      value,
      createdById: dbUser.id,
      updatedById: dbUser.id,
    },
    update: { value, updatedById: dbUser.id },
  });

  revalidatePath('/profile');
}
