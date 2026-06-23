import 'server-only';

import { $Enums } from '@/prisma/client';

import prisma from '@/lib/prisma';
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
    where: { positionId, deletedAt: null, status: { not: 'draft' } },
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
// Returns cross-user data — must only be called from an admin-gated context.
export async function getApplicationStatusCounts(): Promise<
  Partial<Record<$Enums.ApplicationStatus, number>>
> {
  const rows = await prisma.application.groupBy({
    by: ['status'],
    where: { deletedAt: null },
    _count: true,
  });

  return Object.fromEntries(rows.map((r) => [r.status, r._count]));
}

// Admin-only: returns the most recent non-draft applications across all positions.
// Returns cross-user data (applicant name/email) — must only be called from an admin-gated context.
export async function getRecentApplications(
  take = 10,
): Promise<AdminApplicationListItem[]> {
  return prisma.application.findMany({
    where: { deletedAt: null, status: { not: 'draft' } },
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
  const baseWhere = user.isAdmin
    ? { deletedAt: null, status: { not: 'draft' as const } }
    : {
        deletedAt: null,
        status: { not: 'draft' as const },
        position: { managers: { some: { id: user.id } } },
      };

  return prisma.application.findMany({
    where: {
      ...baseWhere,
      ...(filters.positionId ? { positionId: filters.positionId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.q
        ? {
            user: {
              OR: [
                { name: { contains: filters.q, mode: 'insensitive' } },
                { email: { contains: filters.q, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    },
    select: {
      id: true,
      status: true,
      submittedAt: true,
      position: { select: { id: true, title: true } },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { submittedAt: 'desc' },
    take: 100,
  });
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
