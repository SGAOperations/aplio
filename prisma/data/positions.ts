import 'server-only';

import { cache } from 'react';

import {
  MANAGED_POSITIONS_WINDOW_DAYS,
  NON_TERMINAL_APPLICATION_STATUSES,
  RECENTLY_CLOSED_WINDOW_DAYS,
  UNRESOLVED_APPLICATION_STATUSES,
} from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import {
  type OpenPositionSummaryItem,
  type PositionDetail,
  type PositionForEdit,
  type PositionWithQuestions,
} from '@/lib/types';
import { getPositionAvailability, isAcceptingApplications } from '@/lib/utils';

const positionWithQuestionsSelect = {
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
      allowOther: true,
      format: true,
      order: true,
    },
  },
} as const;

// Filtered post-fetch because the end-of-day-inclusive closesAt math has no clean
// Prisma where equivalent, and one source of truth beats two.
export async function getOpenPositions(): Promise<PositionWithQuestions[]> {
  const positions = await prisma.position.findMany({
    where: { status: 'open', deletedAt: null },
    select: positionWithQuestionsSelect,
    orderBy: { title: 'asc' },
  });
  return positions.filter((p) => isAcceptingApplications(p));
}

// "Recently closed" spans three cases: an explicit closesAt in the window, a closed
// position with no closesAt (updatedAt stands in), and an open row past its closesAt.
export async function getRecentlyClosedPositions(): Promise<
  PositionWithQuestions[]
> {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - RECENTLY_CLOSED_WINDOW_DAYS);

  const positions = await prisma.position.findMany({
    where: {
      deletedAt: null,
      OR: [
        { status: 'closed', closesAt: { gte: cutoff } },
        { status: 'closed', closesAt: null, updatedAt: { gte: cutoff } },
        { status: 'open', closesAt: { gte: cutoff, lte: now } },
      ],
    },
    select: positionWithQuestionsSelect,
    orderBy: [{ closesAt: 'desc' }, { title: 'asc' }],
  });

  // Defensive against a closesAt end-of-day edge case slipping an open row through.
  return positions.filter((p) => {
    if (p.status === 'closed') return true;
    const availability = getPositionAvailability(p);
    return availability === 'closed_by_date';
  });
}

// A closed position stays listed while it still has non-terminal applications, so
// long-dead ones (closed past the window, everything resolved) drop off.
export async function getManagedPositions(
  userId: string,
): Promise<PositionWithQuestions[]> {
  const cutoff30 = new Date();
  cutoff30.setDate(cutoff30.getDate() - MANAGED_POSITIONS_WINDOW_DAYS);

  return prisma.position.findMany({
    where: {
      managers: { some: { id: userId } },
      deletedAt: null,
      OR: [
        { status: 'open' },
        { status: 'closed', closesAt: { gte: cutoff30 } },
        { status: 'closed', closesAt: null, updatedAt: { gte: cutoff30 } },
        {
          applications: {
            some: {
              deletedAt: null,
              status: { in: [...NON_TERMINAL_APPLICATION_STATUSES] },
            },
          },
        },
      ],
    },
    select: positionWithQuestionsSelect,
    orderBy: [{ status: 'asc' }, { title: 'asc' }],
  });
}

// Cross-position data — admin-gated callers only. A closed position stays listed
// while it still has unresolved applicants, so fully-resolved ones drop off.
export async function getAdminPositions(): Promise<PositionWithQuestions[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MANAGED_POSITIONS_WINDOW_DAYS);

  return prisma.position.findMany({
    where: {
      deletedAt: null,
      OR: [
        { status: { in: ['open', 'draft'] } },
        { status: 'closed', closesAt: { gte: cutoff } },
        { status: 'closed', closesAt: null, updatedAt: { gte: cutoff } },
        {
          status: 'closed',
          applications: {
            some: {
              deletedAt: null,
              status: { in: [...UNRESOLVED_APPLICATION_STATUSES] },
            },
          },
        },
      ],
    },
    select: positionWithQuestionsSelect,
    orderBy: { title: 'asc' },
  });
}

export async function getPositionForApply(
  id: string,
): Promise<PositionWithQuestions | null> {
  const position = await prisma.position.findUnique({
    where: { id, status: 'open', deletedAt: null },
    select: positionWithQuestionsSelect,
  });

  // null outside the date window sends the apply route to /positions, where the
  // card shows the effective state.
  if (!position || !isAcceptingApplications(position)) return null;
  return position;
}

export async function getPositionAccess(
  id: string,
): Promise<{ id: string; title: string; managers: { id: string }[] } | null> {
  return prisma.position.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, title: true, managers: { select: { id: true } } },
  });
}

// Cross-position data — admin-gated callers only.
export async function getOpenPositionsSummary(
  take?: number,
): Promise<OpenPositionSummaryItem[]> {
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
    ...(take !== undefined ? { take } : {}),
  });
}

// No status filter — the detail page handles drafts itself, using the id-only
// manager list as its gate.
export async function getPositionDetail(
  id: string,
): Promise<PositionDetail | null> {
  return prisma.position.findFirst({
    where: { id, deletedAt: null },
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
          allowOther: true,
          format: true,
          order: true,
        },
      },
      managers: { select: { id: true } },
    },
  });
}

// A plain count({ where: { status: 'open' } }) would wrongly include upcoming and
// closed-by-date positions, so the date window is applied in JS.
export async function getAcceptingPositionsCount(): Promise<number> {
  const positions = await prisma.position.findMany({
    where: { status: 'open', deletedAt: null },
    select: { status: true, opensAt: true, closesAt: true },
  });
  return positions.filter((p) => isAcceptingApplications(p)).length;
}

// Cached so generateMetadata and the page component share one round-trip per request.
export const getPublicPosition = cache(async function getPublicPosition(
  id: string,
): Promise<PositionWithQuestions | null> {
  return prisma.position.findUnique({
    where: { id, status: 'open', deletedAt: null },
    select: positionWithQuestionsSelect,
  });
});

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
          allowOther: true,
          format: true,
          order: true,
        },
      },
      managers: { select: { id: true, name: true, email: true } },
    },
  });
}
