import 'server-only';

import type { PositionStatus, QuestionType } from '@/prisma/client';

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

// Only the six position fields consumed on the edit page; audit columns are
// excluded so they are never serialized across the server/client boundary.
export type PositionForEdit = {
  id: string;
  title: string;
  description: string;
  status: PositionStatus;
  opensAt: Date | null;
  closesAt: Date | null;
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
): Promise<PositionForEdit | null> {
  return prisma.position.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      opensAt: true,
      closesAt: true,
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
