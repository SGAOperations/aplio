import 'server-only';

import { Prisma } from '@/prisma/client';

import prisma from '@/lib/prisma';

export type PositionWithQuestions = Prisma.PositionGetPayload<{
  include: { questions: true };
}>;

export async function getOpenPositions(): Promise<PositionWithQuestions[]> {
  return prisma.position.findMany({
    where: { status: 'open', deletedAt: null },
    include: {
      questions: { where: { deletedAt: null }, orderBy: { order: 'asc' } },
    },
    orderBy: { title: 'asc' },
  });
}
