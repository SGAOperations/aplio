import 'server-only';

import { type $Enums } from '@/prisma/client';

import {
  DAILY_DIGEST_LOOKBACK_MS,
  NON_REVIEWABLE_APPLICATION_STATUSES,
  PUBLISHED_POSITION_WHERE,
  UNRESOLVED_APPLICATION_STATUSES,
} from '@/lib/constants';
import { currentOrgWeekStart, orgDayStart, toOrgDayString } from '@/lib/dates';
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

// Raw rows, not a groupBy count — the daily digest windows per manager (each
// manager's own last-digest cutoff), so the count per position can't be
// pre-aggregated until each manager's cutoff is known.
async function fetchNewApplications(
  positionIds: string[],
  since: Date,
  until: Date,
): Promise<{ positionId: string; submittedAt: Date }[]> {
  if (positionIds.length === 0) return [];

  return prisma.application.findMany({
    where: {
      positionId: { in: positionIds },
      deletedAt: null,
      status: { notIn: NON_REVIEWABLE_APPLICATION_STATUSES },
      submittedAt: { gt: since, lte: until },
      position: PUBLISHED_POSITION_WHERE,
    },
    select: { positionId: true, submittedAt: true },
  });
}

// A manager's own last `manager_daily_digest` row (success or failure — a
// failed run isn't retried, same as before) anchors their next window, so a
// missed/delayed cron fire can never drop a gap; a manager never digested
// before falls back to DAILY_DIGEST_LOOKBACK_MS.
async function getDigestSinceByManager(
  managerIds: string[],
  fallback: Date,
): Promise<Map<string, Date>> {
  if (managerIds.length === 0) return new Map();

  const rows = await prisma.emailLog.groupBy({
    by: ['userId'],
    where: { template: 'manager_daily_digest', userId: { in: managerIds } },
    _max: { createdAt: true },
  });

  const since = new Map<string, Date>();
  for (const row of rows)
    if (row.userId !== null)
      since.set(row.userId, row._max.createdAt ?? fallback);
  return since;
}

async function tallyStatusBreakdown(
  positionIds: string[],
  statuses: readonly $Enums.ApplicationStatus[],
): Promise<Map<string, Map<$Enums.ApplicationStatus, number>>> {
  const map = new Map<string, Map<$Enums.ApplicationStatus, number>>();
  if (positionIds.length === 0) return map;

  const rows = await prisma.application.groupBy({
    by: ['positionId', 'status'],
    where: {
      positionId: { in: positionIds },
      deletedAt: null,
      status: { in: [...statuses] },
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

/**
 * Managers with new applications since their own last daily digest (or the
 * lookback fallback, for a first-ever digest). A manager with nothing new in
 * their window is counted in `skipped`, whether that's genuinely no activity
 * or a repeat call shortly after a successful send — both collapse to the
 * same "nothing since last time" outcome.
 */
export async function getDailyDigestRecipients(
  now: Date = new Date(),
): Promise<{ recipients: DailyDigestRecipient[]; skipped: number }> {
  const managers = await getManagerCandidates();
  if (managers.length === 0) return { recipients: [], skipped: 0 };

  const managerIds = managers.map((manager) => manager.id);
  const fallbackSince = new Date(now.getTime() - DAILY_DIGEST_LOOKBACK_MS);
  const sinceByManager = await getDigestSinceByManager(
    managerIds,
    fallbackSince,
  );

  const positionIds = managers.flatMap((manager) =>
    manager.managedPositions.map((position) => position.id),
  );
  const earliestSince = managers.reduce((earliest, manager) => {
    const since = sinceByManager.get(manager.id) ?? fallbackSince;
    return since < earliest ? since : earliest;
  }, fallbackSince);

  const applications = await fetchNewApplications(
    positionIds,
    earliestSince,
    now,
  );
  const submittedAtByPosition = new Map<string, Date[]>();
  for (const application of applications) {
    const list = submittedAtByPosition.get(application.positionId) ?? [];
    list.push(application.submittedAt);
    submittedAtByPosition.set(application.positionId, list);
  }

  const recipients: DailyDigestRecipient[] = [];
  let skipped = 0;
  for (const manager of managers) {
    const since = sinceByManager.get(manager.id) ?? fallbackSince;

    const positions: ManagerDigestPosition[] = manager.managedPositions
      .map((position) => ({
        positionId: position.id,
        title: position.title,
        newApplications: (submittedAtByPosition.get(position.id) ?? []).filter(
          (submittedAt) => submittedAt > since,
        ).length,
      }))
      .filter((position) => position.newApplications > 0)
      .sort((a, b) => a.title.localeCompare(b.title));

    const total = positions.reduce(
      (sum, position) => sum + position.newApplications,
      0,
    );
    if (total === 0) {
      skipped += 1;
      continue;
    }

    recipients.push({
      userId: manager.id,
      email: manager.email,
      name: manager.name,
      since,
      positions,
      total,
    });
  }

  return { recipients, skipped };
}

/** Managers with any application still short of a terminal status, gated per org week. */
export async function getWeeklyDigestRecipients(
  now: Date = new Date(),
): Promise<{ recipients: WeeklyDigestRecipient[]; skipped: number }> {
  const managers = await getManagerCandidates();
  if (managers.length === 0) return { recipients: [], skipped: 0 };

  const managerIds = managers.map((manager) => manager.id);

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
  const statusTallies = await tallyStatusBreakdown(
    positionIds,
    UNRESOLVED_APPLICATION_STATUSES,
  );

  const recipients: WeeklyDigestRecipient[] = [];
  for (const manager of candidates) {
    const managerPositionIds = manager.managedPositions.map(
      (position) => position.id,
    );

    const statusCounts = UNRESOLVED_APPLICATION_STATUSES.map((status) => ({
      status,
      count: managerPositionIds.reduce(
        (sum, id) => sum + (statusTallies.get(id)?.get(status) ?? 0),
        0,
      ),
    })).filter((entry) => entry.count > 0);

    const total = statusCounts.reduce((sum, entry) => sum + entry.count, 0);
    if (total === 0) continue;

    const openPositions = manager.managedPositions
      .filter((position) => isAcceptingApplications(position))
      .map((position) => ({ positionId: position.id, title: position.title }))
      .sort((a, b) => a.title.localeCompare(b.title));

    recipients.push({
      userId: manager.id,
      email: manager.email,
      name: manager.name,
      asOfDay: toOrgDayString(now),
      statusCounts,
      openPositions,
    });
  }

  return { recipients, skipped: gatedIds.size };
}
