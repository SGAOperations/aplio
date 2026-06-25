import 'server-only';

import { UNRESOLVED_APPLICATION_STATUSES } from '@/lib/constants';
import prisma from '@/lib/prisma';
import {
  type OpenPositionSummaryItem,
  type PositionForEdit,
  type PositionWithQuestions,
} from '@/lib/types';
import { isAcceptingApplications } from '@/lib/utils';

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

// Manager-aware positions query.
// Admin: all non-deleted positions.
// Non-admin: open positions ∪ positions the user manages (including drafts).
// A plain applicant (manages nothing) collapses to open-only — same as before.
export async function getPositions({
  isAdmin,
  userId,
}: {
  isAdmin: boolean;
  userId: string;
}): Promise<PositionWithQuestions[]> {
  return prisma.position.findMany({
    where: isAdmin
      ? { deletedAt: null }
      : {
          deletedAt: null,
          OR: [{ status: 'open' }, { managers: { some: { id: userId } } }],
        },
    select: positionWithQuestionsSelect,
    orderBy: { title: 'asc' },
  });
}

// Open-only positions for widgets (e.g. dashboard) that must not surface
// a manager's draft/closed positions in an "Open Positions" context.
export async function getOpenPositions(): Promise<PositionWithQuestions[]> {
  return prisma.position.findMany({
    where: { status: 'open', deletedAt: null },
    select: positionWithQuestionsSelect,
    orderBy: { title: 'asc' },
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
