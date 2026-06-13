import 'server-only';

import type { GlobalQuestion } from '@/prisma/client';

import prisma from '@/lib/prisma';

export async function getGlobalQuestions(): Promise<GlobalQuestion[]> {
  return prisma.globalQuestion.findMany({
    where: { deletedAt: null },
    orderBy: { order: 'asc' },
  });
}
