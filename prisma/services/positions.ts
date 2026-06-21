import 'server-only';

import type { Position, PositionStatus, QuestionType } from '@/prisma/client';

import prisma from '@/lib/prisma';

export type PositionManager = {
  id: string;
  name: string | null;
  email: string;
};

// Narrowed question shape — only the fields rendered by the edit page and
// PositionQuestionsSection; audit columns are excluded to avoid leaking them
// across the server/client prop boundary.
export type PositionQuestionForEdit = {
  id: string;
  positionId: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options: string[];
  order: number;
};

export type PositionWithQuestionsAndManagers = Position & {
  questions: PositionQuestionForEdit[];
  managers: PositionManager[];
};

export async function getPositions(includeAll = false) {
  return prisma.position.findMany({
    where: includeAll
      ? { deletedAt: null }
      : { status: 'open', deletedAt: null },
    select: {
      id: true,
      title: true,
      status: true,
      description: true,
      opensAt: true,
      closesAt: true,
      questions: {
        where: { deletedAt: null },
        orderBy: { order: 'asc' },
        select: {
          id: true,
          label: true,
          type: true,
          required: true,
          options: true,
          order: true,
        },
      },
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
      questions: {
        where: { deletedAt: null },
        orderBy: { order: 'asc' },
        select: {
          id: true,
          positionId: true,
          label: true,
          type: true,
          required: true,
          options: true,
          order: true,
        },
      },
      managers: { select: { id: true, name: true, email: true } },
    },
  });
}

// Re-export PositionStatus for use in narrowed position types.
export type { PositionStatus };
