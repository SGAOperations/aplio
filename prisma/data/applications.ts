import 'server-only';

import { $Enums } from '@/prisma/client';

import { prisma } from '@/lib/prisma';
import {
  type AdminApplicationListItem,
  type ApplicationFilters,
  type ApplicationForReview,
  type MyApplicationListItem,
  type PositionApplicationListItem,
} from '@/lib/types';

const applicationSelect = {
  id: true,
  status: true,
  submittedAt: true,
  updatedAt: true,
  positionId: true,
  position: { select: { id: true, title: true } },
} as const;

// Shared scope guard: admins see all non-draft; managers see only their positions.
// Used by both getApplications (filtered list) and getApplicationsTotal (denominator)
// so the two always cover the same universe of rows.
function buildBaseWhere(user: { id: string; isAdmin: boolean }) {
  return user.isAdmin
    ? { deletedAt: null, status: { not: 'draft' as const } }
    : {
        deletedAt: null,
        status: { not: 'draft' as const },
        position: { managers: { some: { id: user.id } } },
      };
}

export async function getMyApplications(
  userId: string,
): Promise<MyApplicationListItem[]> {
  return prisma.application.findMany({
    where: { userId, deletedAt: null },
    select: applicationSelect,
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getRecentMyApplications(
  userId: string,
  take = 5,
): Promise<MyApplicationListItem[]> {
  return prisma.application.findMany({
    where: { userId, deletedAt: null },
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
    },
    select: positionApplicationSelect,
    orderBy: { submittedAt: 'desc' },
  });
}

// Authorization is folded into the where clause: admins see any application;
// managers only see applications for positions they manage. Unauthorized callers
// and soft-deleted records both return null, which the page converts to notFound().
export async function getApplicationForReview(
  id: string,
  user: { id: string; isAdmin: boolean },
): Promise<ApplicationForReview | null> {
  const where = user.isAdmin
    ? { id, deletedAt: null }
    : {
        id,
        deletedAt: null,
        position: { managers: { some: { id: user.id } } },
      };

  return prisma.application.findFirst({
    where,
    select: {
      id: true,
      status: true,
      submittedAt: true,
      user: { select: { name: true, email: true } },
      position: { select: { id: true, title: true } },
      globalAnswers: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true, questionLabel: true, value: true },
      },
      positionAnswers: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true, questionLabel: true, value: true },
      },
    },
  });
}

export async function getMyApplicationStatusCounts(
  userId: string,
): Promise<Partial<Record<$Enums.ApplicationStatus, number>>> {
  const rows = await prisma.application.groupBy({
    by: ['status'],
    where: { userId, deletedAt: null },
    _count: true,
  });

  return Object.fromEntries(rows.map((r) => [r.status, r._count]));
}

// Admin-only: returns application counts grouped by status across all positions.
// Excludes drafts and withdrawn applications — counts active pipeline statuses only.
// Returns cross-user data — must only be called from an admin-gated context.
export async function getApplicationStatusCounts(): Promise<
  Partial<Record<$Enums.ApplicationStatus, number>>
> {
  const rows = await prisma.application.groupBy({
    by: ['status'],
    where: { deletedAt: null, status: { notIn: ['draft', 'withdrawn'] } },
    _count: true,
  });

  return Object.fromEntries(rows.map((r) => [r.status, r._count]));
}

// Admin-only: returns the most recent non-draft, non-withdrawn applications across all positions.
// Returns cross-user data (applicant name/email) — must only be called from an admin-gated context.
export async function getRecentApplications(
  take = 10,
): Promise<AdminApplicationListItem[]> {
  return prisma.application.findMany({
    where: { deletedAt: null, status: { notIn: ['draft', 'withdrawn'] } },
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

// Returns all non-draft applications the caller may review, with optional
// filters applied on top of the caller-scoped where clause (no IDOR).
// Admins see all; managers see only their positions'. Returns cross-user data
// (applicant identity + position) — must only be called from a reviewer-gated context.
// Capped at 100 rows as a query-cost guard; full pagination is a future follow-up.
export async function getApplications(
  user: { id: string; isAdmin: boolean },
  filters: ApplicationFilters,
): Promise<AdminApplicationListItem[]> {
  const baseWhere = buildBaseWhere(user);

  // Build date-range clause when q looks like a year (e.g. "2026") or a
  // "Mon YYYY" string (e.g. "Jun 2026"). This lets reviewers search by date
  // without raw-SQL formatting — Prisma DateTime filters are range-based.
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

  // Text search covers applicant name, email, and position title.
  // When the query also resolves to a date range the full clause is an OR
  // so that typing "Jun 2026" finds both date-matched and name/title-matched rows.
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
    take: 100,
  });
}

// Applicant-scoped: count of non-draft applications for the stat card.
// Uses a direct count rather than re-fetching the full groupBy result to keep it cheap.
export async function getMySubmittedCount(userId: string): Promise<number> {
  return prisma.application.count({
    where: { userId, deletedAt: null, status: { not: 'draft' } },
  });
}

// Applicant-scoped: most recent non-draft applications ordered by last update,
// used for the applicant activity feed. Reuses applicationSelect which includes updatedAt.
export async function getMyRecentActivity(
  userId: string,
  take = 10,
): Promise<MyApplicationListItem[]> {
  return prisma.application.findMany({
    where: { userId, deletedAt: null, status: { not: 'draft' } },
    select: applicationSelect,
    orderBy: { updatedAt: 'desc' },
    take,
  });
}

// Caller-scoped unfiltered count of non-draft applications, used for the
// toolbar "shown / total" display. Shares the same scope as getApplications
// via buildBaseWhere — the two always cover the same universe of rows.
// No filters are applied — this is the denominator for the count display.
export async function getApplicationsTotal(user: {
  id: string;
  isAdmin: boolean;
}): Promise<number> {
  return prisma.application.count({ where: buildBaseWhere(user) });
}

// Returns positions the caller may review — used to populate the Position filter
// Select on /applications. Admins see all non-deleted; managers see their positions.
export async function getReviewablePositions(user: {
  id: string;
  isAdmin: boolean;
}): Promise<{ id: string; title: string }[]> {
  const where = user.isAdmin
    ? { deletedAt: null }
    : { deletedAt: null, managers: { some: { id: user.id } } };

  return prisma.position.findMany({
    where,
    select: { id: true, title: true },
    orderBy: { title: 'asc' },
  });
}
