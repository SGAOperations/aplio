import 'server-only';

import prisma from '@/lib/prisma';
import type { Position, PositionQuestion, User } from '@/prisma/client';

export type PositionWithQuestionsAndManagers = Position & {
  questions: PositionQuestion[];
  managers: User[];
};

export async function getPositions(includeAll = false) {
  return prisma.position.findMany({
    where: includeAll ? { deletedAt: null } : { status: 'open', deletedAt: null },
    include: {
      questions: { where: { deletedAt: null }, orderBy: { order: 'asc' } },
    },
    orderBy: { title: 'asc' },
  });
}

export async function getPositionForEdit(
  id: string,
): Promise<PositionWithQuestionsAndManagers | null> {
  return prisma.position.findFirst({
    where: { id, deletedAt: null },
    include: {
      questions: { where: { deletedAt: null }, orderBy: { order: 'asc' } },
      managers: true,
    },
  });
}
