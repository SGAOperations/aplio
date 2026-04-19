import 'server-only';

import type { GlobalAnswer, GlobalQuestion } from '@/prisma/client';

import prisma from '@/lib/prisma';

export async function getProfileData(
  userId: string,
): Promise<{ question: GlobalQuestion; answer: GlobalAnswer | null }[]> {
  const questions = await prisma.globalQuestion.findMany({
    where: { deletedAt: null },
    orderBy: { order: 'asc' },
    include: { answers: { where: { userId } } },
  });

  return questions.map(({ answers, ...question }) => ({
    question,
    answer: answers[0] ?? null,
  }));
}
