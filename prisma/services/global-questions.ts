import 'server-only';

import prisma from '@/lib/prisma';

export async function getGlobalQuestions() {
  return prisma.globalQuestion.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      order: true,
      label: true,
      type: true,
      required: true,
      options: true,
      createdAt: true,
      updatedAt: true,
      createdById: true,
      updatedById: true,
    },
    orderBy: { order: 'asc' },
  });
}
