import 'server-only';

import { $Enums, type Prisma } from '@/prisma/client';
import { positionActivitySelect } from '@/prisma/data/positions';

import {
  buildApplicationWhere,
  buildReviewablePositionWhere,
} from '@/lib/auth/scopes';
import {
  APPLICATIONS_PAGE_SIZE,
  PUBLISHED_POSITION_WHERE,
  VISIBLE_POSITION_WHERE,
} from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import {
  type AdminApplicationListItem,
  type ApplicantOtherApplication,
  type ApplicationFilters,
  type ApplicationForReview,
  type ApplicationReviewAnswer,
  type ApplicationStatusHistoryEntry,
  type DraftApplication,
  type MyApplicationDetail,
  type MyApplicationListItem,
  type PositionApplicationStats,
  type ReviewableApplicant,
  type Reviewer,
} from '@/lib/types';
import { canReviewPosition, isPositionActive } from '@/lib/utils';

const applicationSelect = {
  id: true,
  status: true,
  submittedAt: true,
  updatedAt: true,
  positionId: true,
  deletedAt: true,
  position: {
    select: {
      id: true,
      title: true,
      status: true,
      opensAt: true,
      closesAt: true,
    },
  },
} as const;

// Reused by getApplicationForReview and getMyApplication so both detail
// views normalize answers into the same ApplicationReviewAnswer[] shape.
const applicationAnswersSelect = {
  globalAnswers: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      globalQuestionId: true,
      questionLabel: true,
      questionType: true,
      value: true,
    },
  },
  positionAnswers: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      positionQuestionId: true,
      questionLabel: true,
      questionType: true,
      value: true,
    },
  },
} as const;

type ApplicationAnswersPayload = Prisma.ApplicationGetPayload<{
  select: typeof applicationAnswersSelect;
}>;

function normalizeApplicationAnswers(application: ApplicationAnswersPayload): {
  globalAnswers: ApplicationReviewAnswer[];
  positionAnswers: ApplicationReviewAnswer[];
} {
  return {
    globalAnswers: application.globalAnswers.map((a) => ({
      id: a.id,
      questionId: a.globalQuestionId,
      questionLabel: a.questionLabel,
      value: a.value,
      type: a.questionType,
      isGlobal: true,
    })),
    positionAnswers: application.positionAnswers.map((a) => ({
      id: a.id,
      questionId: a.positionQuestionId,
      questionLabel: a.questionLabel,
      value: a.value,
      type: a.questionType,
      isGlobal: false,
    })),
  };
}

// Scoped to the caller (no IDOR); returns the caller's application at any status
// or deletion state so the apply route decides what to render.
// Predicate must match createDraftApplication's pre-create lookup, or the page
// loops between the entry state and "already exists".
export async function getApplicationForApply(
  userId: string,
  positionId: string,
): Promise<DraftApplication | null> {
  return prisma.application.findFirst({
    where: { userId, positionId },
    include: { globalAnswers: true, positionAnswers: true },
  });
}

// Deleted drafts stay visible so the applicant can restore them; every other
// deleted status is excluded, since only drafts are ever soft-deleted here.
export async function getMyApplications(
  userId: string,
): Promise<MyApplicationListItem[]> {
  return prisma.application.findMany({
    where: {
      userId,
      position: PUBLISHED_POSITION_WHERE,
      OR: [{ deletedAt: null }, { status: 'draft' }],
    },
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

// Same visibility as getMyApplications, so a bookmarked URL can't outlive its list row.
export async function getMyApplication(
  id: string,
  userId: string,
): Promise<MyApplicationDetail | null> {
  const application = await prisma.application.findFirst({
    where: { id, userId, deletedAt: null, position: PUBLISHED_POSITION_WHERE },
    select: { ...applicationSelect, ...applicationAnswersSelect },
  });

  if (!application) return null;

  return { ...application, ...normalizeApplicationAnswers(application) };
}

// Unauthorized and missing both return null; the page maps either to notFound().
export async function getApplicationForReview(
  id: string,
  user: Reviewer,
): Promise<ApplicationForReview | null> {
  const application = await prisma.application.findFirst({
    where: { id, ...buildApplicationWhere(user, 'listable') },
    select: {
      id: true,
      status: true,
      submittedAt: true,
      applicantName: true,
      user: { select: { name: true, email: true } },
      position: {
        select: {
          id: true,
          title: true,
          _count: { select: { questions: { where: { deletedAt: null } } } },
        },
      },
      ...applicationAnswersSelect,
    },
  });

  if (!application) return null;

  const { position, ...rest } = application;
  const { _count, ...positionRest } = position;

  return {
    ...rest,
    position: positionRest,
    hasPositionQuestions: _count.questions > 0,
    ...normalizeApplicationAnswers(application),
  };
}

// listable scope via the relation — a history row for another manager's
// application never resolves, so it can't leak through this query either.
export async function getApplicationStatusHistory(
  applicationId: string,
  user: Reviewer,
): Promise<ApplicationStatusHistoryEntry[]> {
  const events = await prisma.applicationStatusEvent.findMany({
    where: {
      applicationId,
      application: buildApplicationWhere(user, 'listable'),
    },
    // id tiebreaks createdAt: uuid(7) is time-ordered, and bulk createMany
    // rows can share a timestamp.
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      from: true,
      to: true,
      createdAt: true,
      changedBy: { select: { name: true, email: true } },
    },
  });

  return events.map((event) => ({
    id: event.id,
    from: event.from,
    to: event.to,
    createdAt: event.createdAt,
    changedByName: event.changedBy.name ?? event.changedBy.email,
  }));
}

// Cross-scope by design (docs/PERMISSIONS.md) — step 2 deliberately drops buildReviewablePositionWhere.
export async function getApplicantOtherApplications(
  applicationId: string,
  user: Reviewer,
): Promise<ApplicantOtherApplication[]> {
  const anchor = await prisma.application.findFirst({
    where: { id: applicationId, ...buildApplicationWhere(user, 'listable') },
    select: { userId: true },
  });
  if (!anchor) return [];

  const applications = await prisma.application.findMany({
    where: {
      userId: anchor.userId,
      id: { not: applicationId },
      deletedAt: null,
      status: { not: 'draft' },
      position: PUBLISHED_POSITION_WHERE,
    },
    select: {
      id: true,
      status: true,
      submittedAt: true,
      position: {
        select: {
          id: true,
          title: true,
          status: true,
          opensAt: true,
          closesAt: true,
          ...positionActivitySelect,
          managers: { where: { id: user.id }, select: { id: true } },
        },
      },
    },
    orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
  });

  return applications
    .filter((application) => isPositionActive(application.position))
    .map((application) => ({
      id: application.id,
      status: application.status,
      submittedAt: application.submittedAt,
      position: {
        id: application.position.id,
        title: application.position.title,
      },
      canOpen: canReviewPosition(
        user,
        application.position.managers.map((manager) => manager.id),
      ),
    }));
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

// Returns cross-user data — reviewer-gated callers only.
export async function getApplicationStatusCounts(
  reviewer: Reviewer,
): Promise<Partial<Record<$Enums.ApplicationStatus, number>>> {
  const rows = await prisma.application.groupBy({
    by: ['status'],
    where: buildApplicationWhere(reviewer, 'reviewable'),
    _count: true,
  });

  return Object.fromEntries(rows.map((r) => [r.status, r._count]));
}

// Cross-user data — reviewer-gated callers only.
export async function getRecentApplications(
  reviewer: Reviewer,
  take = 10,
): Promise<AdminApplicationListItem[]> {
  return prisma.application.findMany({
    where: buildApplicationWhere(reviewer, 'reviewable'),
    select: {
      id: true,
      status: true,
      submittedAt: true,
      applicantName: true,
      position: { select: { id: true, title: true } },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { submittedAt: 'desc' },
    take,
  });
}

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

// Shared by getApplications and getApplicationsCount so the total can never
// disagree with the rows.
function buildApplicationListWhere(
  user: Reviewer,
  filters: ApplicationFilters,
): Prisma.ApplicationWhereInput {
  const baseWhere = buildApplicationWhere(user, 'listable');

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
        const monthPart = parts[monthIdx] as string;
        const monthNum = MONTH_NAMES.findIndex((m) => monthPart.startsWith(m));
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

  return {
    ...baseWhere,
    ...(filters.positionId ? { positionId: filters.positionId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...textWhere,
  };
}

// { id: 'desc' } tiebreaker: uuid(7) ids are time-ordered, so ties on the
// primary sort key can't be reordered by Postgres between pages.
function buildApplicationListOrderBy(
  sort: ApplicationFilters['sort'],
): Prisma.ApplicationOrderByWithRelationInput[] {
  if (!sort) return [{ submittedAt: 'desc' }, { id: 'desc' }];

  if (sort.field === 'date')
    return [{ submittedAt: sort.direction }, { id: 'desc' }];
  if (sort.field === 'name')
    return [
      { user: { name: sort.direction } },
      { user: { email: sort.direction } },
      { id: 'desc' },
    ];
  return [{ status: sort.direction }, { id: 'desc' }];
}

// Applicant identity — reviewer-gated callers only.
export async function getApplications(
  user: Reviewer,
  filters: ApplicationFilters,
  page = 1,
): Promise<AdminApplicationListItem[]> {
  return prisma.application.findMany({
    where: buildApplicationListWhere(user, filters),
    select: {
      id: true,
      status: true,
      submittedAt: true,
      applicantName: true,
      position: { select: { id: true, title: true } },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: buildApplicationListOrderBy(filters.sort),
    take: APPLICATIONS_PAGE_SIZE,
    skip: (page - 1) * APPLICATIONS_PAGE_SIZE,
  });
}

// Must share buildApplicationListWhere with getApplications — a count built
// from a different where would leak the existence of applications on
// positions the caller doesn't manage.
export async function getApplicationsCount(
  user: Reviewer,
  filters: ApplicationFilters,
): Promise<number> {
  return prisma.application.count({
    where: buildApplicationListWhere(user, filters),
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

export async function getReviewablePositions(
  user: Reviewer,
): Promise<{ id: string; title: string }[]> {
  return prisma.position.findMany({
    where: buildReviewablePositionWhere(user),
    select: { id: true, title: true },
    orderBy: { title: 'asc' },
  });
}

// Cross-user identity — reviewer-gated callers only, same scope as getApplications.
export async function getReviewableApplicants(
  user: Reviewer,
): Promise<ReviewableApplicant[]> {
  return prisma.user.findMany({
    where: { applications: { some: buildApplicationWhere(user, 'listable') } },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
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
      counts: {},
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
