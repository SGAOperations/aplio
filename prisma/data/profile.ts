import 'server-only';

import type { GlobalAnswer, GlobalQuestion } from '@/prisma/client';

import { prisma } from '@/lib/prisma';
import { type ProfileCompleteness } from '@/lib/types';
import { toStringArray } from '@/lib/utils';

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

export async function getProfileCompleteness(
  userId: string,
): Promise<ProfileCompleteness> {
  const requiredQuestions = await prisma.globalQuestion.findMany({
    where: { required: true, deletedAt: null },
    select: { id: true },
  });

  const requiredCount = requiredQuestions.length;

  if (requiredCount === 0)
    return { complete: true, missingCount: 0, requiredCount: 0 };

  const answers = await prisma.globalAnswer.findMany({
    where: {
      userId,
      globalQuestionId: { in: requiredQuestions.map((q) => q.id) },
      deletedAt: null,
    },
    select: { globalQuestionId: true, value: true },
  });

  // Match submitApplication's check: a required question only counts as
  // answered when its value is non-empty, not merely when a row exists.
  const answeredCount = answers.filter(
    (a) => toStringArray(a.value).length > 0,
  ).length;

  const missingCount = requiredCount - answeredCount;
  return { complete: missingCount === 0, missingCount, requiredCount };
}
