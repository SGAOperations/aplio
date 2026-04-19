import prisma from '@/lib/prisma';

export async function getProfileData(userId: string) {
  const [questions, answers] = await Promise.all([
    prisma.globalQuestion.findMany({
      where: { deletedAt: null },
      orderBy: { order: 'asc' },
    }),
    prisma.globalAnswer.findMany({ where: { userId, deletedAt: null } }),
  ]);

  const answerMap = new Map(answers.map((a) => [a.globalQuestionId, a.value]));

  return questions.map((q) => ({ ...q, value: answerMap.get(q.id) ?? [] }));
}

export type ProfileQuestion = Awaited<
  ReturnType<typeof getProfileData>
>[number];
