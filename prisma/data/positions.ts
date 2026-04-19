import 'server-only';

import prisma from '@/lib/prisma';
import { type PositionWithQuestions } from '@/lib/types';

export async function getOpenPositions(): Promise<PositionWithQuestions[]> {
  return prisma.position.findMany({
    where: { status: 'open', deletedAt: null },
    include: {
      questions: { where: { deletedAt: null }, orderBy: { order: 'asc' } },
    },
    orderBy: { title: 'asc' },
  });
}
