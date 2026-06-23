import 'server-only';

import prisma from '@/lib/prisma';
import {
  type OpenPositionSummaryItem,
  type PositionForEdit,
  type PositionWithQuestions,
} from '@/lib/types';
import { isAcceptingApplications } from '@/lib/utils';

export async function getPositions(
  includeAll = false,
): Promise<PositionWithQuestions[]> {
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
  const position = await prisma.position.findUnique({
    where: { id, status: 'open', deletedAt: null },
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
  });

  // Gate: return null for positions outside their date window so the apply route
  // redirects to /positions (which shows the effective state on the card).
  if (!position || !isAcceptingApplications(position)) return null;
  return position;
}

// Minimal fetch for the applications page access check: avoids over-fetching
// the full edit payload when only the title and manager list are needed.
export async function getPositionAccess(
  id: string,
): Promise<{ id: string; title: string; managers: { id: string }[] } | null> {
  return prisma.position.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, title: true, managers: { select: { id: true } } },
  });
}

// Admin-only: open positions with filtered non-draft application counts in a single query.
// Returns cross-position data — must only be called from an admin-gated context.
export async function getOpenPositionsSummary(): Promise<
  OpenPositionSummaryItem[]
> {
  return prisma.position.findMany({
    where: { status: 'open', deletedAt: null },
    select: {
      id: true,
      title: true,
      _count: {
        select: {
          applications: {
            where: { deletedAt: null, status: { not: 'draft' } },
          },
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
