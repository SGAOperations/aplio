import 'server-only';

import type { Position, PositionQuestion } from '@/prisma/client';

import prisma from '@/lib/prisma';

export type PositionManager = {
  id: string;
  name: string | null;
  email: string;
};

export type PositionWithQuestionsAndManagers = Position & {
  questions: PositionQuestion[];
  managers: PositionManager[];
};

export async function getPositions(includeAll = false) {
  return prisma.position.findMany({
    where: includeAll
      ? { deletedAt: null }
      : { status: 'open', deletedAt: null },
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
      managers: { select: { id: true, name: true, email: true } },
    },
  });
}
