import 'server-only';

import prisma from '@/lib/prisma';
import { type PositionForEdit, type PositionWithQuestions } from '@/lib/types';

export async function getOpenPositions(): Promise<PositionWithQuestions[]> {
  return prisma.position.findMany({
    where: { status: 'open', deletedAt: null },
    include: {
      questions: { where: { deletedAt: null }, orderBy: { order: 'asc' } },
    },
    orderBy: { title: 'asc' },
  });
}

export async function getPositions(includeAll = false): Promise<PositionWithQuestions[]> {
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

export async function getPositionForApply(
  id: string,
): Promise<PositionWithQuestions | null> {
  return prisma.position.findUnique({
    where: { id, status: 'open', deletedAt: null },
    include: {
      questions: { where: { deletedAt: null }, orderBy: { order: 'asc' } },
    },
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
