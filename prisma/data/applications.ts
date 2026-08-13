import 'server-only';

import { $Enums } from '@/prisma/client';

import {
  PUBLISHED_POSITION_WHERE,
  VISIBLE_POSITION_WHERE,
} from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import {
  type AdminApplicationListItem,
  type ApplicationFilters,
  type ApplicationForReview,
  type DraftApplication,
  type MyApplicationListItem,
  type PositionApplicationListItem,
  type PositionApplicationStats,
} from '@/lib/types';

const applicationSelect = {
  id: true,
  status: true,
  submittedAt: true,
  updatedAt: true,
  positionId: true,
  position: { select: { id: true, title: true } },
} as const;

// Keeps list, denominator, and detail page agreeing: drafts out, withdrawn in.
function buildBaseWhere(user: { id: string; isAdmin: boolean }) {
  return user.isAdmin
    ? {
        deletedAt: null,
        status: { not: 'draft' as const },
        position: PUBLISHED_POSITION_WHERE,
      }
    : {
        deletedAt: null,
        status: { not: 'draft' as const },
        // Merge, don't overwrite: losing the managers scoping is an authorization regression.
        position: {
          ...PUBLISHED_POSITION_WHERE,
          managers: { some: { id: user.id } },
        },
      };
}

// Scoped to the caller (no IDOR) — lets the apply page open an in-progress
// draft directly instead of re-running the profile-completeness gate, which
// only guards *creating* a new application (see prisma/actions/applications.ts).
export async function getDraftApplication(
  userId: string,
  positionId: string,
): Promise<DraftApplication | null> {
  return prisma.application.findFirst({
    where: { userId, positionId, status: 'draft', deletedAt: null },
    include: { globalAnswers: true, positionAnswers: true },
  });
}

export async function getMyApplications(
  userId: string,
): Promise<MyApplicationListItem[]> {
  return prisma.application.findMany({
    where: { userId, deletedAt: null, position: PUBLISHED_POSITION_WHERE },
    select: applicationSelect,
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getRecentMyApplications(
  userId: string,
  take = 5,
): Promise<MyApplicationListItem[]> {
  return prisma.application.findMany({
    where: { userId, deletedAt: null, position: PUBLISHED_POSITION_WHERE },
    select: applicationSelect,
    orderBy: { updatedAt: 'desc' },
    take,
  });
}

const positionApplicationSelect = {
  id: true,
  status: true,
  submittedAt: true,
  user: { select: { id: true, name: true, email: true } },
} as const;

export async function getPositionApplications(
  positionId: string,
): Promise<PositionApplicationListItem[]> {
  return prisma.application.findMany({
    where: {
      positionId,
      deletedAt: null,
      status: { notIn: ['draft', 'withdrawn'] },
      // Drafts stay visible; defence in depth, callers pass non-deleted ids.
      position: VISIBLE_POSITION_WHERE,
    },
    select: positionApplicationSelect,
    orderBy: { submittedAt: 'desc' },
  });
}

// Unauthorized and missing both return null; the page maps either to notFound().
export async function getApplicationForReview(
  id: string,
  user: { id: string; isAdmin: boolean },
): Promise<ApplicationForReview | null> {
  const application = await prisma.application.findFirst({
    where: { id, ...buildBaseWhere(user) },
    select: {
      id: true,
      status: true,
      submittedAt: true,
      user: { select: { name: true, email: true } },
      position: { select: { id: true, title: true } },
      globalAnswers: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          globalQuestionId: true,
          questionLabel: true,
          value: true,
          globalQuestion: { select: { type: true } },
        },
      },
      positionAnswers: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          positionQuestionId: true,
          questionLabel: true,
          value: true,
          positionQuestion: { select: { type: true } },
        },
      },
    },
  });

  if (!application) return null;

  const { globalAnswers, positionAnswers, ...rest } = application;

  return {
    ...rest,
    globalAnswers: globalAnswers.map((a) => ({
      id: a.id,
      questionId: a.globalQuestionId,
      questionLabel: a.questionLabel,
      value: a.value,
      type: a.globalQuestion.type,
      isGlobal: true,
    })),
    positionAnswers: positionAnswers.map((a) => ({
      id: a.id,
      questionId: a.positionQuestionId,
      questionLabel: a.questionLabel,
      value: a.value,
      type: a.positionQuestion.type,
      isGlobal: false,
    })),
  };
}

export async function getMyApplicationStatusCounts(
  userId: string,
): Promise<Partial<Record<$Enums.ApplicationStatus, number>>> {
  const rows = await prisma.application.groupBy({
    by: ['status'],
    where: { userId, deletedAt: null, position: PUBLISHED_POSITION_WHERE },
    _count: true,
  });

  return Object.fromEntries(rows.map((r) => [r.status, r._count]));
}

// Returns cross-user data — must only be called from an admin-gated context.
export async function getApplicationStatusCounts(): Promise<
  Partial<Record<$Enums.ApplicationStatus, number>>
> {
  const rows = await prisma.application.groupBy({
    by: ['status'],
    where: {
      deletedAt: null,
      status: { notIn: ['draft', 'withdrawn'] },
      position: PUBLISHED_POSITION_WHERE,
    },
    _count: true,
  });

  return Object.fromEntries(rows.map((r) => [r.status, r._count]));
}

// Cross-user data — admin-gated callers only.
export async function getRecentApplications(
  take = 10,
): Promise<AdminApplicationListItem[]> {
  return prisma.application.findMany({
    where: {
      deletedAt: null,
      status: { notIn: ['draft', 'withdrawn'] },
      position: PUBLISHED_POSITION_WHERE,
    },
    select: {
      id: true,
      status: true,
      submittedAt: true,
      position: { select: { id: true, title: true } },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { submittedAt: 'desc' },
    take,
  });
}

// Applicant identity — reviewer-gated callers only. Capped at 100 rows.
export async function getApplications(
  user: { id: string; isAdmin: boolean },
  filters: ApplicationFilters,
): Promise<AdminApplicationListItem[]> {
  const baseWhere = buildBaseWhere(user);

  // Prisma DateTime filters are range-based, so a date query becomes a range.
  const MONTH_NAMES = [
    'jan',
    'feb',
    'mar',
    'apr',
    'may',
    'jun',
    'jul',
    'aug',
    'sep',
    'oct',
    'nov',
    'dec',
  ];
  let dateWhere: { submittedAt?: { gte: Date; lt: Date } } = {};
  if (filters.q) {
    const q = filters.q.trim();
    const yearOnly = /^\d{4}$/.exec(q);
    if (yearOnly) {
      const y = parseInt(q, 10);
      dateWhere = {
        submittedAt: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) },
      };
    } else {
      // Match "Jun 2026" or "2026 Jun" or "June 2026" etc.
      const parts = q.toLowerCase().split(/[\s,]+/);
      const monthIdx = parts.findIndex((p) =>
        MONTH_NAMES.some((m) => p.startsWith(m)),
      );
      const yearPart = parts.find((p) => /^\d{4}$/.test(p));
      if (monthIdx !== -1 && yearPart) {
        const monthNum = MONTH_NAMES.findIndex((m) =>
          parts[monthIdx].startsWith(m),
        );
        const y = parseInt(yearPart, 10);
        dateWhere = {
          submittedAt: {
            gte: new Date(y, monthNum, 1),
            lt: new Date(y, monthNum + 1, 1),
          },
        };
      }
    }
  }

  // OR'd with the date range so a date query also matches names and titles.
  const textWhere = filters.q
    ? {
        OR: [
          {
            user: {
              OR: [
                { name: { contains: filters.q, mode: 'insensitive' as const } },
                {
                  email: { contains: filters.q, mode: 'insensitive' as const },
                },
              ],
            },
          },
          {
            position: {
              title: { contains: filters.q, mode: 'insensitive' as const },
            },
          },
          ...(dateWhere.submittedAt
            ? [{ submittedAt: dateWhere.submittedAt }]
            : []),
        ],
      }
    : {};

  const sort = filters.sort;
  const orderBy = sort
    ? sort.field === 'date'
      ? { submittedAt: sort.direction }
      : sort.field === 'name'
        ? [
            { user: { name: sort.direction } },
            { user: { email: sort.direction } },
          ]
        : { status: sort.direction }
    : ({ submittedAt: 'desc' } as const);

  return prisma.application.findMany({
    where: {
      ...baseWhere,
      ...(filters.positionId ? { positionId: filters.positionId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...textWhere,
    },
    select: {
      id: true,
      status: true,
      submittedAt: true,
      position: { select: { id: true, title: true } },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy,
    // One past the cap, so the caller can tell truncated from exactly-100.
    take: 101,
  });
}

// Uses a direct count rather than re-fetching the full groupBy result to keep it cheap.
export async function getMySubmittedCount(userId: string): Promise<number> {
  return prisma.application.count({
    where: {
      userId,
      deletedAt: null,
      status: { not: 'draft' },
      position: PUBLISHED_POSITION_WHERE,
    },
  });
}

export async function getMyRecentActivity(
  userId: string,
  take = 10,
): Promise<MyApplicationListItem[]> {
  return prisma.application.findMany({
    where: {
      userId,
      deletedAt: null,
      status: { not: 'draft' },
      position: PUBLISHED_POSITION_WHERE,
    },
    select: applicationSelect,
    orderBy: { updatedAt: 'desc' },
    take,
  });
}

export async function getApplicationsTotal(user: {
  id: string;
  isAdmin: boolean;
}): Promise<number> {
  return prisma.application.count({ where: buildBaseWhere(user) });
}

export async function getReviewablePositions(user: {
  id: string;
  isAdmin: boolean;
}): Promise<{ id: string; title: string }[]> {
  // Drafts excluded: a filter shouldn't offer a position with zero visible rows.
  const where = user.isAdmin
    ? PUBLISHED_POSITION_WHERE
    : { ...PUBLISHED_POSITION_WHERE, managers: { some: { id: user.id } } };

  return prisma.position.findMany({
    where,
    select: { id: true, title: true },
    orderBy: { title: 'asc' },
  });
}

// Cross-user aggregate — pass only position ids the caller manages.
export async function getPositionApplicationStats(
  positionIds: string[],
): Promise<Map<string, PositionApplicationStats>> {
  if (positionIds.length === 0) return new Map();

  const rows = await prisma.application.groupBy({
    by: ['positionId', 'status'],
    where: {
      positionId: { in: positionIds },
      deletedAt: null,
      status: { notIn: ['draft', 'withdrawn'] },
      // Drafts stay visible; defence in depth, callers pass non-deleted ids.
      position: VISIBLE_POSITION_WHERE,
    },
    _count: true,
  });

  const map = new Map<string, PositionApplicationStats>();

  for (const row of rows) {
    const existing = map.get(row.positionId) ?? {
      positionId: row.positionId,
      counts: {} as Partial<Record<$Enums.ApplicationStatus, number>>,
      total: 0,
    };
    existing.counts[row.status] = row._count;
    existing.total += row._count;
    map.set(row.positionId, existing);
  }

  for (const id of positionIds) {
    if (!map.has(id)) map.set(id, { positionId: id, counts: {}, total: 0 });
  }

  return map;
}
