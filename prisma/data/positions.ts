import 'server-only';

import { cache } from 'react';

import {
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

// Shared select shape for PositionWithQuestions queries — extracted once so
// every function returns the same type without duplicating the object literal.
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
      order: true,
    },
  },
} as const;

// Public: positions currently accepting applications (status 'open', non-deleted).
// Post-fetch filter via isAcceptingApplications drops 'upcoming' and 'closed_by_date'
// rows — the end-of-day-inclusive closesAt math cannot be expressed cleanly in a
// Prisma where clause, so filtering post-fetch keeps one source of truth.
export async function getOpenPositions(): Promise<PositionWithQuestions[]> {
  const positions = await prisma.position.findMany({
    where: { status: 'open', deletedAt: null },
    select: positionWithQuestionsSelect,
    orderBy: { title: 'asc' },
  });
  return positions.filter((p) => isAcceptingApplications(p));
}

// Public: positions closed within the last RECENTLY_CLOSED_WINDOW_DAYS days.
// Three OR branches cover the different ways a position can be "recently closed":
//   1. status:'closed' with an explicit closesAt within the window
//   2. status:'closed' with no closesAt — fall back to updatedAt recency
//   3. status:'open' with a closesAt in the past (within the window) — closed_by_date
// Post-fetch filter keeps only rows that are actually closed (status:'closed' or
// availability:'closed_by_date') so a still-accepting or upcoming open row never lands here.
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
        // Explicitly closed, close date within the window
        { status: 'closed', closesAt: { gte: cutoff } },
        // Closed without an explicit close date — use updatedAt as a proxy
        { status: 'closed', closesAt: null, updatedAt: { gte: cutoff } },
        // Still 'open' in the DB but past its closesAt within the window
        { status: 'open', closesAt: { gte: cutoff, lte: now } },
      ],
    },
    select: positionWithQuestionsSelect,
    orderBy: [{ closesAt: 'desc' }, { title: 'asc' }],
  });

  // Keep only rows that are genuinely closed — drops any open row that is
  // still accepting or upcoming (should not happen given the where, but
  // ensures correctness if closesAt end-of-day math creates an edge case).
  return positions.filter((p) => {
    if (p.status === 'closed') return true;
    const availability = getPositionAvailability(p);
    return availability === 'closed_by_date';
  });
}

// Manager-facing: positions the user manages that still warrant attention.
// A managed position is included when any of these hold:
//   - status is 'open' (always active)
//   - status is 'closed' and closesAt is within the last 30 days
//   - status is 'closed' and closesAt is null, but updatedAt is within 30 days
//   - has at least one application in a non-terminal status (including 'draft')
// Long-dead managed positions (closed >30 days ago, all applications resolved) are hidden.
// The 30-day window deliberately differs from RECENTLY_CLOSED_WINDOW_DAYS (7 days)
// so managers retain visibility for longer while the public "Recently Closed" section
// stays concise.
export async function getManagedPositions(
  userId: string,
): Promise<PositionWithQuestions[]> {
  const cutoff30 = new Date();
  cutoff30.setDate(cutoff30.getDate() - 30);

  return prisma.position.findMany({
    where: {
      managers: { some: { id: userId } },
      deletedAt: null,
      OR: [
        { status: 'open' },
        // Recently closed via explicit close date (30-day window)
        { status: 'closed', closesAt: { gte: cutoff30 } },
        // Recently closed fallback when closesAt is null — use updatedAt recency
        { status: 'closed', closesAt: null, updatedAt: { gte: cutoff30 } },
        // Closed but still has non-terminal applications
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

// Admin-only: returns all positions still worth an admin's attention.
// A position is included when any of these hold:
//   - status is 'open' or 'draft' (always show)
//   - status is 'closed' and closesAt is within the last 30 days
//   - status is 'closed' and closesAt is null, but updatedAt is within the last 30 days
//   - status is 'closed' with at least one unresolved applicant
// Fully-resolved closed positions (closed >30 days ago, no pending work) are hidden.
// Returns cross-position data — must only be called from an admin-gated context.
export async function getAdminPositions(): Promise<PositionWithQuestions[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  return prisma.position.findMany({
    where: {
      deletedAt: null,
      OR: [
        { status: { in: ['open', 'draft'] } },
        // Recently closed via explicit close date
        { status: 'closed', closesAt: { gte: cutoff } },
        // Recently closed fallback when closesAt is null — use updatedAt recency
        { status: 'closed', closesAt: null, updatedAt: { gte: cutoff } },
        // Closed but still has unresolved applicants (work in progress)
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
// Optional `take` limits the result set; pass 3 for the compact dashboard widget.
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

// Full read payload for the detail page: any non-deleted status (no status filter),
// no applications, managers fetched as id-only for the draft gate check (§3).
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
          order: true,
        },
      },
      managers: { select: { id: true } },
    },
  });
}

// Applicant-facing: count of positions currently accepting applications
// (status open AND inside the date window). Date-window logic is delegated to
// isAcceptingApplications to stay in sync with getPositionAvailability — a pure
// DB count({ where: { status: 'open' } }) would include upcoming/closed-by-date.
export async function getAcceptingPositionsCount(): Promise<number> {
  const positions = await prisma.position.findMany({
    where: { status: 'open', deletedAt: null },
    select: { status: true, opensAt: true, closesAt: true },
  });
  return positions.filter((p) => isAcceptingApplications(p)).length;
}

// Public detail page: only open, non-deleted positions with an explicit select of
// non-sensitive fields. Drafts/closed return null → notFound() at the call site.
// Wrapped in React.cache so generateMetadata and the page component share one DB
// round-trip per request even when both call this function independently.
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
          order: true,
        },
      },
      managers: { select: { id: true, name: true, email: true } },
    },
  });
}
