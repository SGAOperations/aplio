import 'server-only';

import { cache } from 'react';

import {
  MANAGED_POSITIONS_WINDOW_DAYS,
  NON_REVIEWABLE_APPLICATION_STATUSES,
  PUBLISHED_POSITION_WHERE,
  RECENTLY_CLOSED_WINDOW_DAYS,
  UNRESOLVED_APPLICATION_STATUSES,
} from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import {
  type ManagedPosition,
  type ManagedPositionSummaryItem,
  type OpenPositionSummaryItem,
  type PositionDeletionSummary,
  type PositionDetail,
  type PositionForEdit,
  type PositionWithQuestions,
} from '@/lib/types';
import {
  getPositionAvailability,
  isAcceptingApplications,
  isPositionActive,
} from '@/lib/utils';

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
// only adds the fields select doesn't already cover. One row per non-deleted
// application, each carrying at most its latest counted status event —
// withPositionActivity below flattens that to a single lastStatusChangeAt and
// must change together with this fragment (it's the one joint Prisma can't
// type-check). Excludes NON_REVIEWABLE_APPLICATION_STATUSES targets (draft,
// withdrawn) so a withdrawal — or a draft, which can't exist on an already-closed
// position anyway — can't re-pin an otherwise-idle position active (#340, #581).
export const positionActivitySelect = {
  updatedAt: true,
  applications: {
    where: { deletedAt: null },
    select: {
      statusEvents: {
        where: { to: { notIn: [...NON_REVIEWABLE_APPLICATION_STATUSES] } },
        orderBy: { createdAt: 'desc' as const },
        take: 1,
        select: { createdAt: true },
      },
    },
  },
};

// Decodes positionActivitySelect's per-application rows into the single
// timestamp isPositionActive needs. Must change together with the fragment above.
export function withPositionActivity<
  T extends { applications: { statusEvents: { createdAt: Date }[] }[] },
>(row: T): Omit<T, 'applications'> & { lastStatusChangeAt: Date | null } {
  const { applications, ...rest } = row;
  const timestamps = applications
    .map((application) => application.statusEvents[0]?.createdAt)
    .filter((createdAt): createdAt is Date => createdAt !== undefined);

  return {
    ...rest,
    lastStatusChangeAt:
      timestamps.length > 0
        ? new Date(Math.max(...timestamps.map((t) => t.getTime())))
        : null,
  };
}

// Filtered post-fetch so isAcceptingApplications stays the single source of truth.
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

  // Defensive: keeps isAcceptingApplications as the single source of truth for the edge cases.
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
  const positions = await prisma.position.findMany({
    where: { managers: { some: { id: userId } }, deletedAt: null },
    select: { ...positionWithQuestionsSelect, ...positionActivitySelect },
    // Enum order puts draft first, then open, then closed.
    orderBy: [{ status: 'asc' }, { title: 'asc' }],
  });
  return positions.map(withPositionActivity);
}

// Manager dashboard's "My Positions" widget: lean rows, aggregate counts only.
export async function getManagedPositionsSummary(
  userId: string,
  take?: number,
): Promise<ManagedPositionSummaryItem[]> {
  return prisma.position.findMany({
    where: { managers: { some: { id: userId } }, deletedAt: null },
    select: {
      id: true,
      title: true,
      status: true,
      opensAt: true,
      closesAt: true,
      _count: {
        select: {
          applications: {
            where: {
              deletedAt: null,
              status: { notIn: ['draft', 'withdrawn'] },
            },
          },
        },
      },
    },
    // Enum order puts draft first, then open, then closed.
    orderBy: [{ status: 'asc' }, { title: 'asc' }],
    ...(take !== undefined ? { take } : {}),
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
export const getPositionForApply = cache(async function getPositionForApply(
  id: string,
): Promise<PositionWithQuestions | null> {
  return prisma.position.findUnique({
    where: { id, ...PUBLISHED_POSITION_WHERE },
    select: positionWithQuestionsSelect,
  });
});

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
// Cached so generateMetadata and the page component share one round-trip per request.
export const getPositionDetail = cache(async function getPositionDetail(
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
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
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
});

// A plain count would include upcoming and closed-by-date, so JS applies the window.
export async function getAcceptingPositionsCount(): Promise<number> {
  const positions = await prisma.position.findMany({
    where: { status: 'open', deletedAt: null },
    select: { status: true, opensAt: true, closesAt: true },
  });
  return positions.filter((p) => isAcceptingApplications(p)).length;
}

// Cached so generateMetadata and the page component share one round-trip per request.
export const getPositionForEdit = cache(async function getPositionForEdit(
  id: string,
): Promise<PositionForEdit | null> {
  const position = await prisma.position.findFirst({
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
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
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
          // Filtered count of non-deleted answers on non-deleted applications —
          // powers the delete-question confirmation's "N applications already
          // answered" warning (advisory only; see the ticket's risks/notes).
          _count: {
            select: {
              answers: {
                where: { deletedAt: null, application: { deletedAt: null } },
              },
            },
          },
        },
      },
      managers: { select: { id: true, name: true, email: true } },
      ...positionActivitySelect,
    },
  });

  if (!position) return null;

  const { questions, ...rest } = withPositionActivity(position);

  return {
    ...rest,
    questions: questions.map(({ _count, ...question }) => ({
      ...question,
      answerCount: _count.answers,
    })),
  };
});

// Mirrors checkPositionAccess's admin short-circuit; a missing/deleted position
// returns false, so a caller needing "no longer exists" checks existence first.
export async function checkPositionEditable(
  positionId: string,
  user: { id: string; isAdmin: boolean },
): Promise<boolean> {
  if (user.isAdmin) return true;

  const position = await prisma.position.findFirst({
    where: { id: positionId, deletedAt: null },
    select: {
      status: true,
      opensAt: true,
      closesAt: true,
      ...positionActivitySelect,
    },
  });

  return position !== null && isPositionActive(withPositionActivity(position));
}

// Admin-gated edit page only; counts exclude soft-deleted applications.
export async function getPositionDeletionSummary(
  positionId: string,
): Promise<PositionDeletionSummary> {
  const [submittedCount, draftCount] = await Promise.all([
    prisma.application.count({
      where: { positionId, deletedAt: null, status: { not: 'draft' } },
    }),
    prisma.application.count({
      where: { positionId, deletedAt: null, status: 'draft' },
    }),
  ]);

  return { submittedCount, draftCount };
}
