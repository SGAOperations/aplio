import 'server-only';

import { cache } from 'react';

import { Prisma } from '@/prisma/client';
import type { $Enums } from '@/prisma/client';

import {
  CHOICE_TYPES,
  INSIGHTS_ABANDONED_DRAFT_DAYS,
  INSIGHTS_CHART_MAX_ROWS,
  INSIGHTS_MIN_SAMPLE,
  INSIGHTS_OLDEST_LIST_SIZE,
  INSIGHTS_OTHER_POSITIONS_LABEL,
  INSIGHTS_TOP_POSITION_SERIES,
  ORG_TIMEZONE,
  UNRESOLVED_APPLICATION_STATUSES,
} from '@/lib/constants';
import {
  bucketAgingDays,
  bucketAppsPerApplicant,
  bucketDeadlineRushHours,
  bucketLongAnswerChars,
  bucketProfileCompleteness,
  classifyChoiceValue,
  classifyTransition,
  fillSeries,
  fillStackedSeries,
  median,
  meetsSample,
  percent,
  summarizeDurationHours,
} from '@/lib/insights';
import { prisma } from '@/lib/prisma';
import type {
  AnswerRateRow,
  ApplicantInsights,
  AttentionInsights,
  ChoiceDistributionQuestion,
  FunnelInsights,
  InsightsRange,
  PipelineInsights,
  PositionInsights,
  QuestionInsights,
  ReviewSpeedInsights,
  VolumeInsights,
} from '@/lib/types';
import {
  calculateAnswerCompletion,
  displayUserName,
  getDisplayName,
} from '@/lib/utils';

// Every aggregate on this admin-only surface lives here — admin-gated callers only.

// Naive `timestamp(3)` columns store UTC wall-clock; this resolves the org-local wall-clock instant for bucketing.
function orgLocal(column: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`((${column}) AT TIME ZONE 'UTC') AT TIME ZONE ${ORG_TIMEZONE}`;
}

function orgDayTrunc(column: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`date_trunc('day', ${orgLocal(column)})::date`;
}

function orgWeekTrunc(column: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`date_trunc('week', ${orgLocal(column)})::date`;
}

function rangeStartFilter(column: Prisma.Sql, start: Date | null): Prisma.Sql {
  return start ? Prisma.sql`AND ${column} >= ${start}` : Prisma.empty;
}

function rangeEndFilter(column: Prisma.Sql, end: Date): Prisma.Sql {
  return Prisma.sql`AND ${column} <= ${end}`;
}

/**
 * Earliest real (`from IS NOT NULL`) `ApplicationStatusEvent`, globally —
 * `null` on a fresh install with no history yet. `cache()`d since three
 * review-speed metrics all need it.
 */
export const getInsightsHistoryStart = cache(
  async function getInsightsHistoryStart(): Promise<Date | null> {
    const rows = await prisma.$queryRaw<{ historyStart: Date | null }[]>`
      SELECT min(e."createdAt") AS "historyStart"
      FROM "ApplicationStatusEvent" e
      WHERE e."from" IS NOT NULL
    `;
    return rows[0]?.historyStart ?? null;
  },
);

/** Picks between the page empty state and the full page. */
export async function hasAnySubmittedApplication(): Promise<boolean> {
  const count = await prisma.application.count({
    where: { deletedAt: null, submittedAt: { not: null } },
  });
  return count > 0;
}

// ─── Needs Attention (not range-bound — a stuck application never ages out) ─

export async function getAttentionInsights(): Promise<AttentionInsights> {
  const [untouchedRows, agingRows] = await Promise.all([
    prisma.$queryRaw<{ count: bigint; oldestDays: number | null }[]>`
      SELECT count(*)::int AS count,
             (extract(epoch FROM max(now() - a."submittedAt")) / 86400)::float8 AS "oldestDays"
      FROM "Application" a
      JOIN "Position" p ON p.id = a."positionId" AND p."deletedAt" IS NULL
      JOIN "User" u ON u.id = a."userId" AND u."deletedAt" IS NULL
      WHERE a."deletedAt" IS NULL
        AND a."submittedAt" IS NOT NULL
        AND a.status = 'applied'::"ApplicationStatus"
    `,
    prisma.$queryRaw<
      {
        applicationId: string;
        applicantName: string | null;
        userName: string | null;
        userEmail: string;
        positionTitle: string;
        status: string;
        ageDays: number;
      }[]
    >`
      WITH last_real_event AS (
        SELECT e."applicationId", max(e."createdAt") AS "lastAt"
        FROM "ApplicationStatusEvent" e
        WHERE e."from" IS NOT NULL
        GROUP BY e."applicationId"
      )
      SELECT a.id AS "applicationId",
             a."applicantName",
             u.name AS "userName",
             u.email AS "userEmail",
             p.title AS "positionTitle",
             a.status::text AS status,
             (extract(epoch FROM (now() - GREATEST(COALESCE(lre."lastAt", a."submittedAt"), a."submittedAt"))) / 86400)::float8 AS "ageDays"
      FROM "Application" a
      JOIN "Position" p ON p.id = a."positionId" AND p."deletedAt" IS NULL
      JOIN "User" u ON u.id = a."userId" AND u."deletedAt" IS NULL
      LEFT JOIN last_real_event lre ON lre."applicationId" = a.id
      WHERE a."deletedAt" IS NULL
        AND a."submittedAt" IS NOT NULL
        AND a.status IN (${Prisma.join(UNRESOLVED_APPLICATION_STATUSES)})
      ORDER BY "ageDays" DESC
    `,
  ]);

  const untouched = untouchedRows[0] ?? { count: 0n, oldestDays: null };
  const agingAll = agingRows.map((r) => ({
    ...r,
    status:
      r.status as AttentionInsights['agingQueue']['oldest'][number]['status'],
  }));

  return {
    untouched: {
      count: Number(untouched.count),
      oldestDays: untouched.oldestDays,
    },
    agingQueue: {
      n: agingAll.length,
      buckets: bucketAgingDays(agingAll.map((r) => r.ageDays)),
      oldest: agingAll
        .slice(0, INSIGHTS_OLDEST_LIST_SIZE)
        .map((r) => ({
          applicationId: r.applicationId,
          name: getDisplayName({
            applicantName: r.applicantName,
            user: { name: r.userName, email: r.userEmail },
          }),
          positionTitle: r.positionTitle,
          status: r.status,
          ageDays: r.ageDays,
        })),
    },
  };
}

// ─── Volume (#3, #4, #32, #33) ──────────────────────────────────────────────

function computeOpenDays(
  window: { opensAt: Date | null; closesAt: Date | null; createdAt: Date },
  range: InsightsRange,
  now: Date,
): number {
  const windowStart = window.opensAt ?? window.createdAt;
  const lowerBound = range.start
    ? Math.max(windowStart.getTime(), range.start.getTime())
    : windowStart.getTime();
  const upperCandidates = [range.end.getTime(), now.getTime()];
  if (window.closesAt) upperCandidates.push(window.closesAt.getTime());
  const upperBound = Math.min(...upperCandidates);
  return Math.max(1, (upperBound - lowerBound) / 86_400_000);
}

export async function getVolumeInsights(
  range: InsightsRange,
): Promise<VolumeInsights> {
  const now = new Date();
  const submittedAt = Prisma.sql`a."submittedAt"`;
  const dayOrWeek =
    range.granularity === 'week'
      ? orgWeekTrunc(submittedAt)
      : orgDayTrunc(submittedAt);
  const rangeFilter = Prisma.sql`${rangeStartFilter(submittedAt, range.start)} ${rangeEndFilter(submittedAt, range.end)}`;

  const [
    seriesRows,
    byPositionRows,
    positionRows,
    heatmapRows,
    deadlineRushRows,
  ] = await Promise.all([
    prisma.$queryRaw<{ day: string; count: bigint }[]>`
        SELECT ${dayOrWeek}::text AS day, count(*)::int AS count
        FROM "Application" a
        JOIN "Position" p ON p.id = a."positionId" AND p."deletedAt" IS NULL
        JOIN "User" u ON u.id = a."userId" AND u."deletedAt" IS NULL
        WHERE a."deletedAt" IS NULL AND a."submittedAt" IS NOT NULL ${rangeFilter}
        GROUP BY 1
      `,
    prisma.$queryRaw<{ day: string; positionId: string; count: bigint }[]>`
        SELECT ${dayOrWeek}::text AS day, p.id AS "positionId", count(*)::int AS count
        FROM "Application" a
        JOIN "Position" p ON p.id = a."positionId" AND p."deletedAt" IS NULL
        JOIN "User" u ON u.id = a."userId" AND u."deletedAt" IS NULL
        WHERE a."deletedAt" IS NULL AND a."submittedAt" IS NOT NULL ${rangeFilter}
        GROUP BY 1, p.id
      `,
    prisma.$queryRaw<
      {
        positionId: string;
        title: string;
        opensAt: Date | null;
        closesAt: Date | null;
        createdAt: Date;
        count: bigint;
      }[]
    >`
        SELECT p.id AS "positionId", p.title, p."opensAt", p."closesAt", p."createdAt",
               count(*)::int AS count
        FROM "Application" a
        JOIN "Position" p ON p.id = a."positionId" AND p."deletedAt" IS NULL
        JOIN "User" u ON u.id = a."userId" AND u."deletedAt" IS NULL
        WHERE a."deletedAt" IS NULL AND a."submittedAt" IS NOT NULL ${rangeFilter}
        GROUP BY p.id, p.title, p."opensAt", p."closesAt", p."createdAt"
        ORDER BY count DESC
      `,
    prisma.$queryRaw<{ weekday: number; block: number; count: bigint }[]>`
        SELECT extract(dow FROM ${orgLocal(submittedAt)})::int AS weekday,
               floor(extract(hour FROM ${orgLocal(submittedAt)}) / 3)::int AS block,
               count(*)::int AS count
        FROM "Application" a
        JOIN "Position" p ON p.id = a."positionId" AND p."deletedAt" IS NULL
        JOIN "User" u ON u.id = a."userId" AND u."deletedAt" IS NULL
        WHERE a."deletedAt" IS NULL AND a."submittedAt" IS NOT NULL ${rangeFilter}
        GROUP BY 1, 2
      `,
    prisma.$queryRaw<{ hours: number }[]>`
        SELECT (extract(epoch FROM (p."closesAt" - a."submittedAt")) / 3600)::float8 AS hours
        FROM "Application" a
        JOIN "Position" p ON p.id = a."positionId" AND p."deletedAt" IS NULL
        JOIN "User" u ON u.id = a."userId" AND u."deletedAt" IS NULL
        WHERE a."deletedAt" IS NULL AND a."submittedAt" IS NOT NULL
          AND p."closesAt" IS NOT NULL ${rangeFilter}
      `,
  ]);

  const series = fillSeries(
    new Map(seriesRows.map((r) => [r.day, Number(r.count)])),
    range,
  );

  const mostAppliedAll = positionRows.map((r) => ({
    positionId: r.positionId,
    title: r.title,
    count: Number(r.count),
  }));
  const mostAppliedTop = mostAppliedAll.slice(0, INSIGHTS_CHART_MAX_ROWS);

  const topRows = positionRows.slice(0, INSIGHTS_TOP_POSITION_SERIES);
  const topIds = new Set(topRows.map((r) => r.positionId));
  const hasOther = positionRows.length > INSIGHTS_TOP_POSITION_SERIES;
  const stackedKeys = [
    ...topRows.map((r) => ({ positionId: r.positionId, label: r.title })),
    ...(hasOther
      ? [{ positionId: 'other', label: INSIGHTS_OTHER_POSITIONS_LABEL }]
      : []),
  ];
  const stackedSeries = fillStackedSeries(
    byPositionRows.map((r) => ({
      day: r.day,
      key: topIds.has(r.positionId) ? r.positionId : 'other',
      count: Number(r.count),
    })),
    range,
    stackedKeys.map((k) => k.positionId),
  );

  const eligibleForRate = positionRows.filter(
    (r) => Number(r.count) >= INSIGHTS_MIN_SAMPLE,
  );
  const mostAppliedPerOpenDay = eligibleForRate
    .map((r) => {
      const openDays = computeOpenDays(r, range, now);
      const count = Number(r.count);
      return {
        positionId: r.positionId,
        title: r.title,
        count,
        openDays,
        rate: count / openDays,
      };
    })
    .sort((a, b) => b.rate - a.rate);

  return {
    n: mostAppliedAll.reduce((sum, r) => sum + r.count, 0),
    series,
    stackedSeries,
    stackedKeys,
    mostAppliedTop,
    mostAppliedAll,
    mostAppliedPerOpenDay,
    droppedFromRate: positionRows.length - eligibleForRate.length,
    heatmap: heatmapRows.map((r) => ({
      weekday: r.weekday,
      block: r.block,
      count: Number(r.count),
    })),
    deadlineRush: bucketDeadlineRushHours(deadlineRushRows.map((r) => r.hours)),
  };
}

// ─── Review Speed (#1, #2, #5, T1) ──────────────────────────────────────────

// Pre-history submissions have no real event to measure against — survivorship bias.
function coveredFilter(historyStart: Date | null): Prisma.Sql {
  return historyStart
    ? Prisma.sql`AND a."submittedAt" >= ${historyStart}`
    : Prisma.sql`AND false`;
}

export async function getReviewSpeedInsights(
  range: InsightsRange,
): Promise<ReviewSpeedInsights> {
  const submittedAt = Prisma.sql`a."submittedAt"`;
  const rangeFilter = Prisma.sql`${rangeStartFilter(submittedAt, range.start)} ${rangeEndFilter(submittedAt, range.end)}`;
  const historyStart = await getInsightsHistoryStart();
  const covered = coveredFilter(historyStart);

  const [
    totalCountRows,
    coveredCountRows,
    decisionRows,
    firstReplyRows,
    timeInStageRows,
    timeToCompleteRows,
  ] = await Promise.all([
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*)::int AS count
      FROM "Application" a
      JOIN "Position" p ON p.id = a."positionId" AND p."deletedAt" IS NULL
      JOIN "User" u ON u.id = a."userId" AND u."deletedAt" IS NULL
      WHERE a."deletedAt" IS NULL AND a."submittedAt" IS NOT NULL ${rangeFilter}
    `,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*)::int AS count
      FROM "Application" a
      JOIN "Position" p ON p.id = a."positionId" AND p."deletedAt" IS NULL
      JOIN "User" u ON u.id = a."userId" AND u."deletedAt" IS NULL
      WHERE a."deletedAt" IS NULL AND a."submittedAt" IS NOT NULL ${rangeFilter} ${covered}
    `,
    prisma.$queryRaw<{ hours: number }[]>`
      SELECT (extract(epoch FROM (first_decision."createdAt" - a."submittedAt")) / 3600)::float8 AS hours
      FROM "Application" a
      JOIN "Position" p ON p.id = a."positionId" AND p."deletedAt" IS NULL
      JOIN "User" u ON u.id = a."userId" AND u."deletedAt" IS NULL
      JOIN LATERAL (
        SELECT e."createdAt" FROM "ApplicationStatusEvent" e
        WHERE e."applicationId" = a.id AND e."from" IS NOT NULL
          AND e."to" IN ('accepted', 'rejected') AND e."createdAt" >= a."submittedAt"
        ORDER BY e."createdAt" ASC LIMIT 1
      ) first_decision ON true
      WHERE a."deletedAt" IS NULL AND a."submittedAt" IS NOT NULL ${rangeFilter} ${covered}
    `,
    prisma.$queryRaw<{ hours: number }[]>`
      SELECT (extract(epoch FROM (first_reply."createdAt" - a."submittedAt")) / 3600)::float8 AS hours
      FROM "Application" a
      JOIN "Position" p ON p.id = a."positionId" AND p."deletedAt" IS NULL
      JOIN "User" u ON u.id = a."userId" AND u."deletedAt" IS NULL
      JOIN LATERAL (
        SELECT e."createdAt" FROM "ApplicationStatusEvent" e
        WHERE e."applicationId" = a.id AND e."from" = 'applied'::"ApplicationStatus"
          AND e."to" <> 'withdrawn'::"ApplicationStatus" AND e."createdAt" >= a."submittedAt"
        ORDER BY e."createdAt" ASC LIMIT 1
      ) first_reply ON true
      WHERE a."deletedAt" IS NULL AND a."submittedAt" IS NOT NULL ${rangeFilter} ${covered}
    `,
    prisma.$queryRaw<{ to: string; hours: number }[]>`
      WITH ordered_events AS (
        SELECT e."to", e."createdAt",
               LEAD(e."createdAt") OVER (PARTITION BY e."applicationId" ORDER BY e."createdAt") AS "nextAt"
        FROM "ApplicationStatusEvent" e
        JOIN "Application" a ON a.id = e."applicationId" AND a."deletedAt" IS NULL
        JOIN "Position" p ON p.id = a."positionId" AND p."deletedAt" IS NULL
        JOIN "User" u ON u.id = a."userId" AND u."deletedAt" IS NULL
        WHERE e."from" IS NOT NULL
      )
      SELECT "to"::text AS "to", (extract(epoch FROM ("nextAt" - "createdAt")) / 3600)::float8 AS hours
      FROM ordered_events
      WHERE "nextAt" IS NOT NULL
        AND "to" IN (${Prisma.join(UNRESOLVED_APPLICATION_STATUSES)})
        ${rangeStartFilter(Prisma.sql`"createdAt"`, range.start)} ${rangeEndFilter(Prisma.sql`"createdAt"`, range.end)}
    `,
    prisma.$queryRaw<{ hours: number }[]>`
      SELECT (extract(epoch FROM (a."submittedAt" - a."createdAt")) / 3600)::float8 AS hours
      FROM "Application" a
      JOIN "Position" p ON p.id = a."positionId" AND p."deletedAt" IS NULL
      JOIN "User" u ON u.id = a."userId" AND u."deletedAt" IS NULL
      WHERE a."deletedAt" IS NULL AND a."submittedAt" IS NOT NULL ${rangeFilter} ${covered}
        AND NOT EXISTS (
          SELECT 1 FROM "ApplicationStatusEvent" e
          WHERE e."applicationId" = a.id AND e."from" IS NOT NULL AND e."to" = 'withdrawn'::"ApplicationStatus"
        )
    `,
  ]);

  const totalCount = Number(totalCountRows[0]?.count ?? 0);
  const coveredCount = Number(coveredCountRows[0]?.count ?? 0);
  const coverage = { coveredCount, totalCount, historyStart };

  const timeToDecision = summarizeDurationHours(
    decisionRows.map((r) => r.hours),
  );
  const firstReply = summarizeDurationHours(firstReplyRows.map((r) => r.hours));

  const timeInStage = UNRESOLVED_APPLICATION_STATUSES.map((status) => {
    const hours = timeInStageRows
      .filter((r) => r.to === status)
      .map((r) => r.hours);
    return { status, n: hours.length, medianHours: median(hours) };
  });

  return {
    timeToDecision: {
      ...timeToDecision,
      awaitingCount: coveredCount - timeToDecision.n,
      coverage,
    },
    firstReply: {
      ...firstReply,
      awaitingCount: coveredCount - firstReply.n,
      coverage,
    },
    timeInStage,
    timeToComplete: summarizeDurationHours(
      timeToCompleteRows.map((r) => r.hours),
    ),
  };
}

// ─── Pipeline (#6, #7, #13, #14, T2) ────────────────────────────────────────

export async function getPipelineInsights(
  range: InsightsRange,
): Promise<PipelineInsights> {
  const createdAt = Prisma.sql`e."createdAt"`;
  const eventRangeFilter = Prisma.sql`${rangeStartFilter(createdAt, range.start)} ${rangeEndFilter(createdAt, range.end)}`;

  const matrixRows = await prisma.$queryRaw<
    { from: string; to: string; count: bigint }[]
  >`
    SELECT e."from"::text AS "from", e."to"::text AS "to", count(*)::int AS count
    FROM "ApplicationStatusEvent" e
    JOIN "Application" a ON a.id = e."applicationId" AND a."deletedAt" IS NULL
    JOIN "Position" p ON p.id = a."positionId" AND p."deletedAt" IS NULL
    JOIN "User" u ON u.id = a."userId" AND u."deletedAt" IS NULL
    WHERE e."from" IS NOT NULL AND e."from" <> 'draft'::"ApplicationStatus" ${eventRangeFilter}
    GROUP BY 1, 2
  `;

  const transitionMatrix = matrixRows.map((r) => ({
    from: r.from as $Enums.ApplicationStatus,
    to: r.to as $Enums.ApplicationStatus,
    count: Number(r.count),
  }));

  let backwardCount = 0;
  let decisionFlipCount = 0;
  let reviewerEventCount = 0;
  for (const cell of transitionMatrix) {
    const kind = classifyTransition(cell.from, cell.to);
    if (kind === 'backward') backwardCount += cell.count;
    if (kind === 'flip') decisionFlipCount += cell.count;
    if (kind !== 'offPath') reviewerEventCount += cell.count;
  }

  return {
    n: transitionMatrix.reduce((sum, c) => sum + c.count, 0),
    backwardCount,
    decisionFlipCount,
    reviewerEventCount,
  };
}

// ─── Funnel (#10, #11, #12, #19) ────────────────────────────────────────────

export async function getFunnelInsights(
  range: InsightsRange,
): Promise<FunnelInsights> {
  const createdAt = Prisma.sql`a."createdAt"`;
  const cohortRangeFilter = Prisma.sql`${rangeStartFilter(createdAt, range.start)} ${rangeEndFilter(createdAt, range.end)}`;

  const [conversionRows, abandonedRows] = await Promise.all([
    prisma.$queryRaw<
      { positionId: string; title: string; starts: bigint; converted: bigint }[]
    >`
      SELECT p.id AS "positionId", p.title,
             count(*)::int AS starts,
             count(*) FILTER (WHERE a."submittedAt" IS NOT NULL)::int AS converted
      FROM "Application" a
      JOIN "Position" p ON p.id = a."positionId" AND p."deletedAt" IS NULL
      JOIN "User" u ON u.id = a."userId" AND u."deletedAt" IS NULL
      WHERE a."deletedAt" IS NULL ${cohortRangeFilter}
      GROUP BY p.id, p.title
    `,
    prisma.$queryRaw<
      {
        applicationId: string;
        positionId: string;
        title: string;
        lastOrder: number | null;
        ageDays: number;
      }[]
    >`
      WITH abandoned AS (
        SELECT a.id, a."positionId", p.title, a."updatedAt"
        FROM "Application" a
        JOIN "Position" p ON p.id = a."positionId" AND p."deletedAt" IS NULL
        JOIN "User" u ON u.id = a."userId" AND u."deletedAt" IS NULL
        WHERE a."deletedAt" IS NULL AND a.status = 'draft'::"ApplicationStatus"
          AND a."updatedAt" < now() - (${INSIGHTS_ABANDONED_DRAFT_DAYS} || ' days')::interval
          ${cohortRangeFilter}
      )
      SELECT ab.id AS "applicationId", ab."positionId", ab.title,
             max(pq."order") AS "lastOrder",
             (extract(epoch FROM (now() - ab."updatedAt")) / 86400)::float8 AS "ageDays"
      FROM abandoned ab
      LEFT JOIN "PositionApplicationAnswer" paa
        ON paa."applicationId" = ab.id AND paa."deletedAt" IS NULL
        AND EXISTS (SELECT 1 FROM unnest(paa.value) v WHERE btrim(v) <> '')
      LEFT JOIN "PositionQuestion" pq
        ON pq.id = paa."positionQuestionId" AND pq."deletedAt" IS NULL
      GROUP BY ab.id, ab."positionId", ab.title, ab."updatedAt"
    `,
  ]);

  const conversion = conversionRows.map((r) => ({
    positionId: r.positionId,
    title: r.title,
    starts: Number(r.starts),
    converted: Number(r.converted),
  }));
  const totalStarts = conversion.reduce((sum, r) => sum + r.starts, 0);
  const totalConverted = conversion.reduce((sum, r) => sum + r.converted, 0);
  const conversionByPosition = conversion
    .filter((r) => r.starts >= INSIGHTS_MIN_SAMPLE)
    .map((r) => ({ ...r, rate: percent(r.converted, r.starts) }));

  const abandonment = {
    count: abandonedRows.length,
    ageBuckets: bucketAgingDays(abandonedRows.map((r) => r.ageDays)),
  };

  const positionIds = [...new Set(abandonedRows.map((r) => r.positionId))];
  const liveQuestions = positionIds.length
    ? await prisma.positionQuestion.findMany({
        where: { positionId: { in: positionIds }, deletedAt: null },
        select: { positionId: true, label: true, order: true },
        orderBy: { order: 'asc' },
      })
    : [];
  const questionsByPosition = new Map<
    string,
    { label: string; order: number }[]
  >();
  for (const q of liveQuestions) {
    const list = questionsByPosition.get(q.positionId) ?? [];
    list.push({ label: q.label, order: q.order });
    questionsByPosition.set(q.positionId, list);
  }

  function nextQuestionLabel(positionId: string, lastOrder: number | null) {
    const questions = questionsByPosition.get(positionId) ?? [];
    const next = questions.find(
      (q) => lastOrder === null || q.order > lastOrder,
    );
    return next?.label ?? null;
  }

  const dropoffByPosition = new Map<
    string,
    { title: string; total: number; groups: Map<number | null, number> }
  >();
  for (const row of abandonedRows) {
    const entry = dropoffByPosition.get(row.positionId) ?? {
      title: row.title,
      total: 0,
      groups: new Map<number | null, number>(),
    };
    entry.total += 1;
    entry.groups.set(row.lastOrder, (entry.groups.get(row.lastOrder) ?? 0) + 1);
    dropoffByPosition.set(row.positionId, entry);
  }

  const dropoff = [...dropoffByPosition.entries()]
    .filter(([, v]) => v.total >= INSIGHTS_MIN_SAMPLE)
    .flatMap(([positionId, v]) =>
      [...v.groups.entries()].map(([lastOrder, count]) => ({
        positionId,
        title: v.title,
        nextQuestionLabel: nextQuestionLabel(positionId, lastOrder),
        count,
      })),
    )
    .sort((a, b) => b.count - a.count)
    .slice(0, INSIGHTS_CHART_MAX_ROWS);

  const cohortPositionIds = conversion
    .filter((r) => r.starts >= INSIGHTS_MIN_SAMPLE)
    .map((r) => r.positionId);
  const requiredCounts = cohortPositionIds.length
    ? await prisma.positionQuestion.groupBy({
        by: ['positionId'],
        where: {
          positionId: { in: cohortPositionIds },
          deletedAt: null,
          required: true,
        },
        _count: { _all: true },
      })
    : [];
  const requiredCountByPosition = new Map(
    requiredCounts.map((r) => [r.positionId, r._count._all]),
  );
  const formLengthVsConversion = conversionByPosition.map((r) => ({
    positionId: r.positionId,
    title: r.title,
    requiredQuestionCount: requiredCountByPosition.get(r.positionId) ?? 0,
    conversionRate: r.rate ?? 0,
    starts: r.starts,
  }));

  return {
    conversion: {
      starts: totalStarts,
      converted: totalConverted,
      rate: percent(totalConverted, totalStarts),
    },
    conversionByPosition,
    abandonment,
    dropoff,
    formLengthVsConversion,
  };
}

// ─── Questions (#15, #16, #17, #18) ─────────────────────────────────────────

const NON_EMPTY_VALUE = (col: Prisma.Sql) =>
  Prisma.sql`EXISTS (SELECT 1 FROM unnest(${col}) v WHERE btrim(v) <> '')`;

export async function getQuestionInsights(
  range: InsightsRange,
): Promise<QuestionInsights> {
  const submittedAt = Prisma.sql`a."submittedAt"`;
  const rangeFilter = Prisma.sql`${rangeStartFilter(submittedAt, range.start)} ${rangeEndFilter(submittedAt, range.end)}`;
  const withSubmitted = Prisma.sql`WITH submitted AS (
    SELECT a.id, a."positionId"
    FROM "Application" a
    JOIN "Position" p ON p.id = a."positionId" AND p."deletedAt" IS NULL
    JOIN "User" u ON u.id = a."userId" AND u."deletedAt" IS NULL
    WHERE a."deletedAt" IS NULL AND a."submittedAt" IS NOT NULL ${rangeFilter}
  )`;

  const [
    totalSubmittedRows,
    globalAnswerRows,
    positionAnswerRows,
    globalChoiceValueRows,
    globalChoiceNRows,
    positionChoiceValueRows,
    positionChoiceNRows,
    longAnswerRows,
  ] = await Promise.all([
    prisma.$queryRaw<
      { count: bigint }[]
    >`${withSubmitted} SELECT count(*)::int AS count FROM submitted`,
    prisma.$queryRaw<{ questionId: string; label: string; answered: bigint }[]>`
      ${withSubmitted}
      SELECT gq.id AS "questionId", gq.label, count(*) FILTER (
        WHERE gaa.id IS NOT NULL AND ${NON_EMPTY_VALUE(Prisma.sql`gaa.value`)}
      )::int AS answered
      FROM "GlobalQuestion" gq
      CROSS JOIN submitted s
      LEFT JOIN "GlobalApplicationAnswer" gaa
        ON gaa."globalQuestionId" = gq.id AND gaa."applicationId" = s.id AND gaa."deletedAt" IS NULL
      WHERE gq."deletedAt" IS NULL AND gq.required = false
      GROUP BY gq.id, gq.label
    `,
    prisma.$queryRaw<
      {
        questionId: string;
        label: string;
        positionTitle: string;
        answered: bigint;
        total: bigint;
      }[]
    >`
      ${withSubmitted}
      SELECT pq.id AS "questionId", pq.label, p2.title AS "positionTitle",
        count(*) FILTER (
          WHERE paa.id IS NOT NULL AND ${NON_EMPTY_VALUE(Prisma.sql`paa.value`)}
        )::int AS answered,
        count(*)::int AS total
      FROM "PositionQuestion" pq
      JOIN "Position" p2 ON p2.id = pq."positionId" AND p2."deletedAt" IS NULL
      JOIN submitted s ON s."positionId" = pq."positionId"
      LEFT JOIN "PositionApplicationAnswer" paa
        ON paa."positionQuestionId" = pq.id AND paa."applicationId" = s.id AND paa."deletedAt" IS NULL
      WHERE pq."deletedAt" IS NULL AND pq.required = false
      GROUP BY pq.id, pq.label, p2.title
    `,
    prisma.$queryRaw<{ questionId: string; value: string; count: bigint }[]>`
      ${withSubmitted}
      SELECT gq.id AS "questionId", v AS value, count(*)::int AS count
      FROM "GlobalQuestion" gq
      JOIN "GlobalApplicationAnswer" gaa ON gaa."globalQuestionId" = gq.id AND gaa."deletedAt" IS NULL
      JOIN submitted s ON s.id = gaa."applicationId"
      CROSS JOIN LATERAL unnest(gaa.value) AS v
      WHERE gq."deletedAt" IS NULL AND gq.type IN (${Prisma.join(CHOICE_TYPES)}) AND btrim(v) <> ''
      GROUP BY gq.id, v
    `,
    prisma.$queryRaw<{ questionId: string; n: bigint }[]>`
      ${withSubmitted}
      SELECT gq.id AS "questionId", count(DISTINCT gaa."applicationId")::int AS n
      FROM "GlobalQuestion" gq
      JOIN "GlobalApplicationAnswer" gaa ON gaa."globalQuestionId" = gq.id AND gaa."deletedAt" IS NULL
      JOIN submitted s ON s.id = gaa."applicationId"
      WHERE gq."deletedAt" IS NULL AND gq.type IN (${Prisma.join(CHOICE_TYPES)})
        AND ${NON_EMPTY_VALUE(Prisma.sql`gaa.value`)}
      GROUP BY gq.id
    `,
    prisma.$queryRaw<{ questionId: string; value: string; count: bigint }[]>`
      ${withSubmitted}
      SELECT pq.id AS "questionId", v AS value, count(*)::int AS count
      FROM "PositionQuestion" pq
      JOIN "Position" pos ON pos.id = pq."positionId" AND pos."deletedAt" IS NULL
      JOIN "PositionApplicationAnswer" paa ON paa."positionQuestionId" = pq.id AND paa."deletedAt" IS NULL
      JOIN submitted s ON s.id = paa."applicationId"
      CROSS JOIN LATERAL unnest(paa.value) AS v
      WHERE pq."deletedAt" IS NULL AND pq.type IN (${Prisma.join(CHOICE_TYPES)}) AND btrim(v) <> ''
      GROUP BY pq.id, v
    `,
    prisma.$queryRaw<{ questionId: string; n: bigint }[]>`
      ${withSubmitted}
      SELECT pq.id AS "questionId", count(DISTINCT paa."applicationId")::int AS n
      FROM "PositionQuestion" pq
      JOIN "Position" pos ON pos.id = pq."positionId" AND pos."deletedAt" IS NULL
      JOIN "PositionApplicationAnswer" paa ON paa."positionQuestionId" = pq.id AND paa."deletedAt" IS NULL
      JOIN submitted s ON s.id = paa."applicationId"
      WHERE pq."deletedAt" IS NULL AND pq.type IN (${Prisma.join(CHOICE_TYPES)})
        AND ${NON_EMPTY_VALUE(Prisma.sql`paa.value`)}
      GROUP BY pq.id
    `,
    prisma.$queryRaw<{ chars: number }[]>`
      ${withSubmitted}
      SELECT char_length(gaa.value[1]) AS chars
      FROM "GlobalApplicationAnswer" gaa
      JOIN submitted s ON s.id = gaa."applicationId"
      WHERE gaa."deletedAt" IS NULL AND gaa."questionType" = 'long_answer'::"QuestionType"
        AND gaa.value[1] IS NOT NULL AND btrim(gaa.value[1]) <> ''
      UNION ALL
      SELECT char_length(paa.value[1]) AS chars
      FROM "PositionApplicationAnswer" paa
      JOIN submitted s ON s.id = paa."applicationId"
      WHERE paa."deletedAt" IS NULL AND paa."questionType" = 'long_answer'::"QuestionType"
        AND paa.value[1] IS NOT NULL AND btrim(paa.value[1]) <> ''
    `,
  ]);

  const totalSubmitted = Number(totalSubmittedRows[0]?.count ?? 0);

  const answerRates: AnswerRateRow[] = [
    ...globalAnswerRows.map((r) => ({
      questionId: r.questionId,
      label: r.label,
      scope: 'global' as const,
      positionTitle: null,
      answered: Number(r.answered),
      total: totalSubmitted,
      rate: percent(Number(r.answered), totalSubmitted),
    })),
    ...positionAnswerRows.map((r) => ({
      questionId: r.questionId,
      label: r.label,
      scope: 'position' as const,
      positionTitle: r.positionTitle,
      answered: Number(r.answered),
      total: Number(r.total),
      rate: percent(Number(r.answered), Number(r.total)),
    })),
  ].sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101));

  const choiceQuestionIds = [
    ...new Set([
      ...globalChoiceValueRows.map((r) => r.questionId),
      ...positionChoiceValueRows.map((r) => r.questionId),
    ]),
  ];
  const [globalChoiceQuestions, positionChoiceQuestions] =
    choiceQuestionIds.length
      ? await Promise.all([
          prisma.globalQuestion.findMany({
            where: { id: { in: choiceQuestionIds }, deletedAt: null },
            select: { id: true, label: true, options: true, allowOther: true },
          }),
          prisma.positionQuestion.findMany({
            where: { id: { in: choiceQuestionIds }, deletedAt: null },
            select: { id: true, label: true, options: true, allowOther: true },
          }),
        ])
      : [[], []];
  const choiceQuestionMeta = new Map(
    [...globalChoiceQuestions, ...positionChoiceQuestions].map((q) => [
      q.id,
      q,
    ]),
  );
  const nByQuestion = new Map(
    [...globalChoiceNRows, ...positionChoiceNRows].map((r) => [
      r.questionId,
      Number(r.n),
    ]),
  );

  const valuesByQuestion = new Map<
    string,
    { value: string; count: bigint }[]
  >();
  for (const row of [...globalChoiceValueRows, ...positionChoiceValueRows]) {
    const list = valuesByQuestion.get(row.questionId) ?? [];
    list.push(row);
    valuesByQuestion.set(row.questionId, list);
  }

  const choiceDistributions: ChoiceDistributionQuestion[] = [
    ...valuesByQuestion.entries(),
  ]
    .map(([questionId, rows]) => {
      const meta = choiceQuestionMeta.get(questionId);
      if (!meta) return null;
      return {
        questionId,
        label: meta.label,
        n: nByQuestion.get(questionId) ?? 0,
        values: rows.map((r) => ({
          value: r.value,
          kind: classifyChoiceValue(r.value, meta.options, meta.allowOther),
          count: Number(r.count),
        })),
      };
    })
    .filter((q): q is ChoiceDistributionQuestion => q !== null);

  const otherUsage = choiceDistributions
    .map((q) => {
      const meta = choiceQuestionMeta.get(q.questionId);
      if (!meta?.allowOther) return null;
      const otherCount = q.values
        .filter((v) => v.kind === 'other')
        .reduce((sum, v) => sum + v.count, 0);
      return {
        questionId: q.questionId,
        label: q.label,
        rate: percent(otherCount, q.n),
        n: q.n,
      };
    })
    .filter((o): o is NonNullable<typeof o> => o !== null);

  const longAnswerChars = longAnswerRows.map((r) => r.chars);

  return {
    answerRates,
    choiceDistributions,
    otherUsage,
    longAnswerEffort: {
      n: longAnswerChars.length,
      medianChars: median(longAnswerChars),
      buckets: bucketLongAnswerChars(longAnswerChars),
    },
  };
}

// ─── Applicants (#20, #21, #22, #23, T3) ────────────────────────────────────

export async function getApplicantInsights(
  range: InsightsRange,
): Promise<ApplicantInsights> {
  const submittedAt = Prisma.sql`a."submittedAt"`;
  const rangeFilter = Prisma.sql`${rangeStartFilter(submittedAt, range.start)} ${rangeEndFilter(submittedAt, range.end)}`;
  const createdAt = Prisma.sql`u."createdAt"`;

  const [
    perApplicantRows,
    newVsReturningRows,
    signupsRows,
    requiredGlobalQuestions,
  ] = await Promise.all([
    prisma.$queryRaw<{ userId: string; count: bigint }[]>`
      SELECT a."userId", count(*)::int AS count
      FROM "Application" a
      JOIN "Position" p ON p.id = a."positionId" AND p."deletedAt" IS NULL
      JOIN "User" u ON u.id = a."userId" AND u."deletedAt" IS NULL
      WHERE a."deletedAt" IS NULL AND a."submittedAt" IS NOT NULL ${rangeFilter}
      GROUP BY a."userId"
    `,
    range.start
      ? prisma.$queryRaw<{ bucket: string; count: bigint }[]>`
          SELECT (CASE WHEN u."createdAt" >= ${range.start} THEN 'new' ELSE 'returning' END) AS bucket,
                 count(DISTINCT a."userId")::int AS count
          FROM "Application" a
          JOIN "Position" p ON p.id = a."positionId" AND p."deletedAt" IS NULL
          JOIN "User" u ON u.id = a."userId" AND u."deletedAt" IS NULL
          WHERE a."deletedAt" IS NULL AND a."submittedAt" IS NOT NULL ${rangeFilter}
          GROUP BY 1
        `
      : Promise.resolve(null),
    prisma.$queryRaw<{ bucket: string; count: bigint }[]>`
      SELECT (
        CASE WHEN EXISTS (
          SELECT 1 FROM "Application" a2 WHERE a2."userId" = u.id AND a2."deletedAt" IS NULL
        ) THEN 'draft' ELSE 'none' END
      ) AS bucket, count(*)::int AS count
      FROM "User" u
      WHERE u."deletedAt" IS NULL ${rangeStartFilter(createdAt, range.start)} ${rangeEndFilter(createdAt, range.end)}
        AND NOT EXISTS (
          SELECT 1 FROM "Application" a3
          WHERE a3."userId" = u.id AND a3."deletedAt" IS NULL AND a3."submittedAt" IS NOT NULL
        )
      GROUP BY 1
    `,
    prisma.globalQuestion.findMany({
      where: { required: true, deletedAt: null },
      select: {
        id: true,
        label: true,
        type: true,
        required: true,
        options: true,
        allowOther: true,
        format: true,
      },
    }),
  ]);

  const perApplicantCounts = perApplicantRows.map((r) => Number(r.count));
  const totalSubmitted = perApplicantCounts.reduce((sum, c) => sum + c, 0);

  const newVsReturning = newVsReturningRows
    ? {
        new: Number(
          newVsReturningRows.find((r) => r.bucket === 'new')?.count ?? 0,
        ),
        returning: Number(
          newVsReturningRows.find((r) => r.bucket === 'returning')?.count ?? 0,
        ),
      }
    : null;

  const usersInRange = await prisma.user.findMany({
    where: {
      deletedAt: null,
      createdAt: { gte: range.start ?? undefined, lte: range.end },
    },
    select: { id: true },
  });
  const answers =
    requiredGlobalQuestions.length > 0 && usersInRange.length > 0
      ? await prisma.globalAnswer.findMany({
          where: {
            userId: { in: usersInRange.map((u) => u.id) },
            globalQuestionId: { in: requiredGlobalQuestions.map((q) => q.id) },
            deletedAt: null,
          },
          select: { userId: true, globalQuestionId: true, value: true },
        })
      : [];
  const answersByUser = new Map<
    string,
    { globalQuestionId: string; value: string[] }[]
  >();
  for (const a of answers) {
    const list = answersByUser.get(a.userId) ?? [];
    list.push(a);
    answersByUser.set(a.userId, list);
  }
  const completenessPercents = usersInRange.map((u) => {
    const values = new Map(
      (answersByUser.get(u.id) ?? []).map((a) => [a.globalQuestionId, a.value]),
    );
    return calculateAnswerCompletion(requiredGlobalQuestions, values).percent;
  });

  return {
    totalSubmitted,
    uniqueApplicants: perApplicantRows.length,
    perApplicantBuckets: bucketAppsPerApplicant(perApplicantCounts),
    repeatApplicantCount: perApplicantCounts.filter((c) => c >= 2).length,
    newVsReturning,
    profileCompleteness: bucketProfileCompleteness(completenessPercents),
    signupsNeverApplied: {
      startedDraft: Number(
        signupsRows.find((r) => r.bucket === 'draft')?.count ?? 0,
      ),
      neverStarted: Number(
        signupsRows.find((r) => r.bucket === 'none')?.count ?? 0,
      ),
    },
  };
}

// ─── Positions and Reviewers (#29, #30, #31, T4) ────────────────────────────

export async function getPositionInsights(
  range: InsightsRange,
): Promise<PositionInsights> {
  const submittedAt = Prisma.sql`a."submittedAt"`;
  const rangeFilter = Prisma.sql`${rangeStartFilter(submittedAt, range.start)} ${rangeEndFilter(submittedAt, range.end)}`;
  const windowOpensAt = Prisma.sql`COALESCE(p."opensAt", p."createdAt")`;
  const historyStart = await getInsightsHistoryStart();
  const covered = coveredFilter(historyStart);
  const eventCreatedAt = Prisma.sql`e."createdAt"`;
  const eventRangeFilter = Prisma.sql`${rangeStartFilter(eventCreatedAt, range.start)} ${rangeEndFilter(eventCreatedAt, range.end)}`;

  const [
    zeroApplicationRows,
    timeToFirstRows,
    managerLoadRows,
    reviewerEventRows,
    reviewerDecisionRows,
  ] = await Promise.all([
    prisma.$queryRaw<{ positionId: string; title: string }[]>`
      SELECT p.id AS "positionId", p.title
      FROM "Position" p
      WHERE p."deletedAt" IS NULL
        AND p.status <> 'draft'::"PositionStatus"
        AND ${windowOpensAt} <= ${range.end}
        AND (p."closesAt" IS NULL ${range.start ? Prisma.sql`OR p."closesAt" >= ${range.start}` : Prisma.sql`OR true`})
        AND NOT EXISTS (
          SELECT 1 FROM "Application" a
          WHERE a."positionId" = p.id AND a."deletedAt" IS NULL AND a."submittedAt" IS NOT NULL ${rangeFilter}
        )
      ORDER BY p.title ASC
    `,
    prisma.$queryRaw<{ positionId: string; title: string; days: number }[]>`
      SELECT p.id AS "positionId", p.title,
             (extract(epoch FROM (min(a."submittedAt") - ${windowOpensAt})) / 86400)::float8 AS days
      FROM "Position" p
      JOIN "Application" a ON a."positionId" = p.id AND a."deletedAt" IS NULL AND a."submittedAt" IS NOT NULL
      WHERE p."deletedAt" IS NULL
        AND ${windowOpensAt} >= ${range.start ?? new Date(0)}
        AND ${windowOpensAt} <= ${range.end}
      GROUP BY p.id, p.title
    `,
    prisma.$queryRaw<
      {
        managerId: string;
        managerName: string | null;
        managerEmail: string;
        submitted: bigint;
        unresolved: bigint;
      }[]
    >`
      WITH pm AS (SELECT "A" AS "positionId", "B" AS "managerId" FROM "_PositionManagers")
      SELECT pm."managerId", u.name AS "managerName", u.email AS "managerEmail",
             count(a.id) FILTER (WHERE a."submittedAt" IS NOT NULL ${rangeFilter})::int AS submitted,
             count(a.id) FILTER (WHERE a.status = 'applied'::"ApplicationStatus")::int AS unresolved
      FROM pm
      JOIN "User" u ON u.id = pm."managerId" AND u."deletedAt" IS NULL
      JOIN "Position" p ON p.id = pm."positionId" AND p."deletedAt" IS NULL
      LEFT JOIN "Application" a ON a."positionId" = p.id AND a."deletedAt" IS NULL
      GROUP BY pm."managerId", u.name, u.email
    `,
    prisma.$queryRaw<{ reviewerId: string; eventCount: bigint }[]>`
      SELECT e."changedById" AS "reviewerId", count(*)::int AS "eventCount"
      FROM "ApplicationStatusEvent" e
      JOIN "Application" a ON a.id = e."applicationId" AND a."deletedAt" IS NULL
      JOIN "Position" p ON p.id = a."positionId" AND p."deletedAt" IS NULL
      WHERE e."from" IS NOT NULL AND e."changedById" <> a."userId" ${eventRangeFilter}
      GROUP BY e."changedById"
    `,
    prisma.$queryRaw<{ reviewerId: string; hours: number }[]>`
      SELECT e."changedById" AS "reviewerId",
             (extract(epoch FROM (e."createdAt" - a."submittedAt")) / 3600)::float8 AS hours
      FROM "ApplicationStatusEvent" e
      JOIN "Application" a ON a.id = e."applicationId" AND a."deletedAt" IS NULL
      JOIN "Position" p ON p.id = a."positionId" AND p."deletedAt" IS NULL
      WHERE e."from" IS NOT NULL AND e."changedById" <> a."userId"
        AND e."to" IN ('accepted', 'rejected') AND e."createdAt" >= a."submittedAt" ${covered} ${eventRangeFilter}
    `,
  ]);

  const reviewerIds = [
    ...new Set([
      ...reviewerEventRows.map((r) => r.reviewerId),
      ...reviewerDecisionRows.map((r) => r.reviewerId),
    ]),
  ];
  const reviewers = reviewerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: reviewerIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const reviewerById = new Map(reviewers.map((r) => [r.id, r]));

  const decisionHoursByReviewer = new Map<string, number[]>();
  for (const row of reviewerDecisionRows) {
    const list = decisionHoursByReviewer.get(row.reviewerId) ?? [];
    list.push(row.hours);
    decisionHoursByReviewer.set(row.reviewerId, list);
  }

  const reviewerThroughput = reviewerEventRows
    .map((r) => {
      const reviewer = reviewerById.get(r.reviewerId);
      const decisionHours = decisionHoursByReviewer.get(r.reviewerId) ?? [];
      return {
        reviewerId: r.reviewerId,
        name: reviewer ? displayUserName(reviewer) : 'Former user',
        eventCount: Number(r.eventCount),
        decisionN: decisionHours.length,
        medianDecisionHours: meetsSample(decisionHours.length)
          ? median(decisionHours)
          : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    zeroApplicationPositions: zeroApplicationRows,
    timeToFirstApplication: {
      medianDays: median(timeToFirstRows.map((r) => r.days)),
      positions: timeToFirstRows,
    },
    managerLoad: managerLoadRows.map((r) => ({
      managerId: r.managerId,
      name: displayUserName({ name: r.managerName, email: r.managerEmail }),
      submitted: Number(r.submitted),
      unresolved: Number(r.unresolved),
    })),
    reviewerThroughput,
  };
}
