import 'server-only';

import { cache } from 'react';

import {
  MANAGED_POSITIONS_WINDOW_DAYS,
  PUBLISHED_POSITION_WHERE,
  RECENTLY_CLOSED_WINDOW_DAYS,
  UNRESOLVED_APPLICATION_STATUSES,
} from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import {
  type ManagedPosition,
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

// Shared fragment for the isPositionActive predicate (lib/utils.ts). Always spread
// alongside positionWithQuestionsSelect, which supplies the status/opensAt/closesAt
// fields isPositionActive also needs (via getPositionAvailability) — this fragment
// only adds the two fields that select doesn't already cover. The `where`
// inside `_count` is the one fragile joint Prisma cannot type-check — any hand-written
// _count.applications select that omits this unresolved-status filter will silently mark
// an archived position active. `isPositionActive` only reads `_count.applications` once a
// position is already closed (open positions return true before `_count` is consulted),
// and `submitApplication` refuses a closed position, so a `draft` row can never be the
// thing keeping a closed position "active" — counting it here only produces a permanent,
// invisible pin (#340). Uses UNRESOLVED_APPLICATION_STATUSES (excludes 'draft') so this
// matches getAdminPositions and the application count actually shown on the position
// card (getPositionApplicationStats, prisma/data/applications.ts). Reused unchanged by
// #360's getPositionForEdit widening so the manager list and the edit-freeze check share
// one source of truth — note #360's edit freeze now also applies to positions this fix
// newly allows to archive.
export const positionActivitySelect = {
  updatedAt: true,
  _count: {
    select: {
      applications: {
        where: {
          deletedAt: null,
          // Fresh mutable array, not the readonly tuple — Prisma's generated
          // filter types require ApplicationStatus[], not readonly [...]. An
          // outer `as const` on this object would re-freeze the spread below,
          // so this fragment is deliberately NOT `as const` (unlike its siblings).
          status: { in: [...UNRESOLVED_APPLICATION_STATUSES] },
        },
      },
    },
  },
};

// Filtered post-fetch: the end-of-day closesAt math has no clean Prisma where.
export async function getOpenPositions(): Promise<PositionWithQuestions[]> {
  const positions = await prisma.position.findMany({
    where: { status: 'open', deletedAt: null },
    select: positionWithQuestionsSelect,
    orderBy: { title: 'asc' },
  });
  return positions.filter((p) => isAcceptingApplications(p));
}

// Three cases: explicit closesAt, closed with updatedAt standing in, open past close.
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

// Manager-facing: every non-deleted position the user manages, including drafts —
// filtering into active/archived is delegated entirely to the pure isPositionActive
// predicate (lib/utils.ts), not encoded here, so the list, the archive toggle, and
// (#360) the manager edit freeze all share one source of truth. Row count is bounded
// by the caller's own managed positions, not by a status/date window.
export async function getManagedPositions(
  userId: string,
): Promise<ManagedPosition[]> {
  return prisma.position.findMany({
    where: { managers: { some: { id: userId } }, deletedAt: null },
    select: { ...positionWithQuestionsSelect, ...positionActivitySelect },
    // Enum order puts draft first, then open, then closed.
    orderBy: [{ status: 'asc' }, { title: 'asc' }],
  });
}

// Cross-position data — admin-gated callers only. Closed stays while unresolved.
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

// Cached so generateMetadata and the page component share one round-trip per request.
// Returns the published position regardless of window — the apply route decides
// what to render (form, closed-window card, or already-applied card).
export const getPositionForApply = cache(async function getPositionForApply(
  id: string,
): Promise<PositionWithQuestions | null> {
  return prisma.position.findUnique({
    where: { id, ...PUBLISHED_POSITION_WHERE },
    select: positionWithQuestionsSelect,
  });
});

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

// No status filter — the detail page gates drafts on the id-only manager list.
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

// A plain count would include upcoming and closed-by-date, so JS applies the window.
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
