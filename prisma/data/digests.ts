import 'server-only';

import { type $Enums } from '@/prisma/client';

import {
  NON_REVIEWABLE_APPLICATION_STATUSES,
  PUBLISHED_POSITION_WHERE,
  REVIEWER_APPLICATION_STATUSES,
  UNRESOLVED_APPLICATION_STATUSES,
} from '@/lib/constants';
import {
  currentOrgWeekStart,
  orgDayStart,
  previousOrgDay,
  previousOrgWeek,
  toOrgDayString,
} from '@/lib/dates';
import { prisma } from '@/lib/prisma';
import {
  type DailyDigestRecipient,
  type ManagerDigestPosition,
  type WeeklyDigestRecipient,
} from '@/lib/types';
import { isAcceptingApplications } from '@/lib/utils';

type ManagerCandidate = {
  id: string;
  email: string;
  name: string | null;
  managedPositions: {
    id: string;
    title: string;
    status: $Enums.PositionStatus;
    opensAt: Date | null;
    closesAt: Date | null;
  }[];
};

// Scoped by the `managers` relation only — never buildReviewablePositionWhere,
// whose admin short-circuit would hand an admin every position.
async function getManagerCandidates(): Promise<ManagerCandidate[]> {
  return prisma.user.findMany({
    where: {
      deletedAt: null,
      managedPositions: { some: PUBLISHED_POSITION_WHERE },
    },
    select: {
      id: true,
      email: true,
      name: true,
      managedPositions: {
        where: PUBLISHED_POSITION_WHERE,
        select: {
          id: true,
          title: true,
          status: true,
          opensAt: true,
          closesAt: true,
        },
      },
    },
  });
}

async function tallyNewApplications(
  positionIds: string[],
  start: Date,
  end: Date,
): Promise<Map<string, number>> {
  if (positionIds.length === 0) return new Map();

  const rows = await prisma.application.groupBy({
    by: ['positionId'],
    where: {
      positionId: { in: positionIds },
      deletedAt: null,
      status: { notIn: NON_REVIEWABLE_APPLICATION_STATUSES },
      submittedAt: { gte: start, lte: end },
      position: PUBLISHED_POSITION_WHERE,
    },
    _count: true,
  });

  return new Map(rows.map((row) => [row.positionId, row._count]));
}

async function tallyStatusBreakdown(
  positionIds: string[],
): Promise<Map<string, Map<$Enums.ApplicationStatus, number>>> {
  const map = new Map<string, Map<$Enums.ApplicationStatus, number>>();
  if (positionIds.length === 0) return map;

  const rows = await prisma.application.groupBy({
    by: ['positionId', 'status'],
    where: {
      positionId: { in: positionIds },
      deletedAt: null,
      status: { notIn: NON_REVIEWABLE_APPLICATION_STATUSES },
      position: PUBLISHED_POSITION_WHERE,
    },
    _count: true,
  });

  for (const row of rows) {
    const existing = map.get(row.positionId) ?? new Map();
    existing.set(row.status, row._count);
    map.set(row.positionId, existing);
  }

  return map;
}

/** Managers with new applications yesterday, minus any already digested today (counted in `skipped`). */
export async function getDailyDigestRecipients(
  now: Date = new Date(),
): Promise<{ recipients: DailyDigestRecipient[]; skipped: number }> {
  const managers = await getManagerCandidates();
  if (managers.length === 0) return { recipients: [], skipped: 0 };

  const managerIds = managers.map((manager) => manager.id);
  const { day, start, end } = previousOrgDay(now);

  const alreadyDigested = await prisma.emailLog.findMany({
    where: {
      template: 'manager_daily_digest',
      userId: { in: managerIds },
      createdAt: { gte: orgDayStart(toOrgDayString(now)) },
    },
    select: { userId: true },
  });
  const gatedIds = new Set(
    alreadyDigested.map((row) => row.userId).filter((id) => id !== null),
  );

  const candidates = managers.filter((manager) => !gatedIds.has(manager.id));
  if (candidates.length === 0)
    return { recipients: [], skipped: gatedIds.size };

  const positionIds = candidates.flatMap((manager) =>
    manager.managedPositions.map((position) => position.id),
  );
  const tallies = await tallyNewApplications(positionIds, start, end);

  const recipients: DailyDigestRecipient[] = [];
  for (const manager of candidates) {
    const positions: ManagerDigestPosition[] = manager.managedPositions
      .map((position) => ({
        positionId: position.id,
        title: position.title,
        newApplications: tallies.get(position.id) ?? 0,
      }))
      .filter((position) => position.newApplications > 0)
      .sort((a, b) => a.title.localeCompare(b.title));

    const total = positions.reduce(
      (sum, position) => sum + position.newApplications,
      0,
    );
    if (total === 0) continue;

    recipients.push({
      userId: manager.id,
      email: manager.email,
      name: manager.name,
      day,
      positions,
      total,
    });
  }

  return { recipients, skipped: gatedIds.size };
}

/** Managers with new or unresolved applications last week, gated like the daily digest. */
export async function getWeeklyDigestRecipients(
  now: Date = new Date(),
): Promise<{ recipients: WeeklyDigestRecipient[]; skipped: number }> {
  const managers = await getManagerCandidates();
  if (managers.length === 0) return { recipients: [], skipped: 0 };

  const managerIds = managers.map((manager) => manager.id);
  const { startDay, endDay, start, end } = previousOrgWeek(now);

  const alreadyDigested = await prisma.emailLog.findMany({
    where: {
      template: 'manager_weekly_digest',
      userId: { in: managerIds },
      createdAt: { gte: orgDayStart(currentOrgWeekStart(now)) },
    },
    select: { userId: true },
  });
  const gatedIds = new Set(
    alreadyDigested.map((row) => row.userId).filter((id) => id !== null),
  );

  const candidates = managers.filter((manager) => !gatedIds.has(manager.id));
  if (candidates.length === 0)
    return { recipients: [], skipped: gatedIds.size };

  const positionIds = candidates.flatMap((manager) =>
    manager.managedPositions.map((position) => position.id),
  );

  const [newTallies, statusTallies] = await Promise.all([
    tallyNewApplications(positionIds, start, end),
    tallyStatusBreakdown(positionIds),
  ]);

  const unresolvedStatuses: readonly $Enums.ApplicationStatus[] =
    UNRESOLVED_APPLICATION_STATUSES;

  const recipients: WeeklyDigestRecipient[] = [];
  for (const manager of candidates) {
    const managerPositionIds = manager.managedPositions.map(
      (position) => position.id,
    );

    const newApplications = managerPositionIds.reduce(
      (sum, id) => sum + (newTallies.get(id) ?? 0),
      0,
    );

    const statusCounts = REVIEWER_APPLICATION_STATUSES.map((status) => ({
      status,
      count: managerPositionIds.reduce(
        (sum, id) => sum + (statusTallies.get(id)?.get(status) ?? 0),
        0,
      ),
    })).filter((entry) => entry.count > 0);

    const unresolvedTotal = statusCounts
      .filter((entry) => unresolvedStatuses.includes(entry.status))
      .reduce((sum, entry) => sum + entry.count, 0);

    if (newApplications === 0 && unresolvedTotal === 0) continue;

    const openPositions = manager.managedPositions
      .filter((position) => isAcceptingApplications(position))
      .map((position) => ({ positionId: position.id, title: position.title }))
      .sort((a, b) => a.title.localeCompare(b.title));

    recipients.push({
      userId: manager.id,
      email: manager.email,
      name: manager.name,
      weekStart: startDay,
      weekEnd: endDay,
      newApplications,
      statusCounts,
      openPositions,
    });
  }

  return { recipients, skipped: gatedIds.size };
}
