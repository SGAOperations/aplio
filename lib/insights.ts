import type { $Enums } from '@/prisma/client';

import {
  INSIGHTS_AGING_BUCKET_EDGES_DAYS,
  INSIGHTS_AGING_BUCKET_LABELS,
  INSIGHTS_APPS_PER_APPLICANT_BUCKET_EDGES,
  INSIGHTS_APPS_PER_APPLICANT_BUCKET_LABELS,
  INSIGHTS_DAILY_MAX_DAYS,
  INSIGHTS_DEADLINE_RUSH_BUCKET_EDGES_HOURS,
  INSIGHTS_DEADLINE_RUSH_BUCKET_LABELS,
  INSIGHTS_DEFAULT_RANGE,
  INSIGHTS_DURATION_BUCKET_EDGES_DAYS,
  INSIGHTS_DURATION_BUCKET_LABELS,
  INSIGHTS_LONG_ANSWER_BUCKET_EDGES_CHARS,
  INSIGHTS_LONG_ANSWER_BUCKET_LABELS,
  INSIGHTS_MIN_SAMPLE,
  INSIGHTS_PROFILE_COMPLETENESS_BUCKET_EDGES,
  INSIGHTS_PROFILE_COMPLETENESS_BUCKET_LABELS,
  getApplicationStatusRank,
} from '@/lib/constants';
import {
  orgDayEnd,
  orgDayStart,
  shiftOrgDay,
  toOrgDayString,
} from '@/lib/dates';
import type {
  CountBucket,
  DurationSummary,
  InsightsRange,
  InsightsRangePreset,
  SeriesPoint,
  StackedSeriesPoint,
} from '@/lib/types';

export const INSIGHT_CHART_HEIGHT_CLASS = 'h-64 w-full aspect-auto';
export const INSIGHT_CARD_SKELETON_HEIGHT_CLASS = 'h-[21.5rem] w-full';

// Calendar-only arithmetic (no timezone resolution needed — both inputs are
// already org-local calendar days), so this is safe across a DST boundary.
function daysBetweenOrgDays(fromDay: string, toDay: string): number {
  const [fy, fm, fd] = fromDay.split('-').map(Number);
  const [ty, tm, td] = toDay.split('-').map(Number);
  const fromUtc = Date.UTC(fy as number, (fm as number) - 1, fd);
  const toUtc = Date.UTC(ty as number, (tm as number) - 1, td);
  return Math.round((toUtc - fromUtc) / 86_400_000) + 1;
}

function resolveGranularity(fromDay: string, toDay: string): 'day' | 'week' {
  return daysBetweenOrgDays(fromDay, toDay) > INSIGHTS_DAILY_MAX_DAYS
    ? 'week'
    : 'day';
}

// Monday of the org-local week containing `day` — a string-keyed twin of
// lib/dates.ts#currentOrgWeekStart, which takes a Date instead.
function weekStartOfOrgDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const dow = new Date(Date.UTC(y as number, (m as number) - 1, d)).getUTCDay();
  const daysSinceMonday = (dow + 6) % 7;
  return shiftOrgDay(day, -daysSinceMonday);
}

export interface InsightsRangeInput {
  range: InsightsRangePreset;
  from: string | null;
  to: string | null;
}

/**
 * Presets are org-local days, today inclusive. `custom` requires a valid
 * `from <= to` (with `to` clamped to today); anything else falls back to
 * `INSIGHTS_DEFAULT_RANGE`.
 */
export function resolveInsightsRange(
  input: InsightsRangeInput,
  now: Date,
): InsightsRange {
  const today = toOrgDayString(now);

  if (input.range === 'custom') {
    if (input.from && input.to) {
      const toDay = input.to > today ? today : input.to;
      if (input.from <= toDay)
        return {
          preset: 'custom',
          start: orgDayStart(input.from),
          end: orgDayEnd(toDay),
          fromDay: input.from,
          toDay,
          granularity: resolveGranularity(input.from, toDay),
        };
    }
    return resolveInsightsRange(
      { range: INSIGHTS_DEFAULT_RANGE, from: null, to: null },
      now,
    );
  }

  if (input.range === 'all')
    return {
      preset: 'all',
      start: null,
      end: orgDayEnd(today),
      fromDay: null,
      toDay: today,
      granularity: 'week',
    };

  const daysBack =
    input.range === '30d' ? 29 : input.range === '90d' ? 89 : 364;
  const fromDay = shiftOrgDay(today, -daysBack);
  return {
    preset: input.range,
    start: orgDayStart(fromDay),
    end: orgDayEnd(today),
    fromDay,
    toDay: today,
    granularity: resolveGranularity(fromDay, today),
  };
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0)
    return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
  return sorted[mid] as number;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Nearest-rank percentile (`p` in `[0, 1]`); `null` for an empty input. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1);
  return sorted[Math.max(0, index)] as number;
}

/** `null` on a zero denominator — the UI shows "—", never `NaN%`. */
export function percent(n: number, d: number): number | null {
  if (d === 0) return null;
  return Math.round((n / d) * 100);
}

/**
 * `edges` are upper-exclusive bounds for every bucket but the last, which
 * catches everything at or above the final edge. `edges.length === labels.length - 1`.
 */
export function bucketize(
  values: number[],
  edges: readonly number[],
  labels: readonly string[],
): CountBucket[] {
  const counts = new Array(labels.length).fill(0) as number[];
  for (const value of values) {
    const index = edges.findIndex((edge) => value < edge);
    const bucket = index === -1 ? labels.length - 1 : index;
    counts[bucket] = (counts[bucket] as number) + 1;
  }
  return labels.map((label, i) => ({ label, count: counts[i] as number }));
}

export function bucketDurationDays(days: number[]): CountBucket[] {
  return bucketize(
    days,
    INSIGHTS_DURATION_BUCKET_EDGES_DAYS,
    INSIGHTS_DURATION_BUCKET_LABELS,
  );
}

export function bucketAgingDays(days: number[]): CountBucket[] {
  return bucketize(
    days,
    INSIGHTS_AGING_BUCKET_EDGES_DAYS,
    INSIGHTS_AGING_BUCKET_LABELS,
  );
}

export function bucketDeadlineRushHours(hours: number[]): CountBucket[] {
  return bucketize(
    hours,
    INSIGHTS_DEADLINE_RUSH_BUCKET_EDGES_HOURS,
    INSIGHTS_DEADLINE_RUSH_BUCKET_LABELS,
  );
}

export function bucketLongAnswerChars(chars: number[]): CountBucket[] {
  return bucketize(
    chars,
    INSIGHTS_LONG_ANSWER_BUCKET_EDGES_CHARS,
    INSIGHTS_LONG_ANSWER_BUCKET_LABELS,
  );
}

export function bucketAppsPerApplicant(counts: number[]): CountBucket[] {
  return bucketize(
    counts,
    INSIGHTS_APPS_PER_APPLICANT_BUCKET_EDGES,
    INSIGHTS_APPS_PER_APPLICANT_BUCKET_LABELS,
  );
}

export function bucketProfileCompleteness(percents: number[]): CountBucket[] {
  return bucketize(
    percents,
    INSIGHTS_PROFILE_COMPLETENESS_BUCKET_EDGES,
    INSIGHTS_PROFILE_COMPLETENESS_BUCKET_LABELS,
  );
}

/** n/median/mean/histogram from a list of per-row durations in hours. */
export function summarizeDurationHours(hoursValues: number[]): DurationSummary {
  return {
    n: hoursValues.length,
    medianHours: median(hoursValues),
    meanHours: mean(hoursValues),
    histogram: bucketDurationDays(hoursValues.map((h) => h / 24)),
  };
}

/** Zero-fills every day/week in `range` from a sparse `day -> count` map. */
export function fillSeries(
  counts: Map<string, number>,
  range: Pick<InsightsRange, 'fromDay' | 'toDay' | 'granularity'>,
): SeriesPoint[] {
  if (range.fromDay === null)
    return [...counts.entries()]
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));

  const step = range.granularity === 'week' ? 7 : 1;
  const start =
    range.granularity === 'week'
      ? weekStartOfOrgDay(range.fromDay)
      : range.fromDay;
  const end =
    range.granularity === 'week' ? weekStartOfOrgDay(range.toDay) : range.toDay;

  const points: SeriesPoint[] = [];
  for (let cursor = start; cursor <= end; cursor = shiftOrgDay(cursor, step))
    points.push({ day: cursor, count: counts.get(cursor) ?? 0 });
  return points;
}

/** Stacked twin of `fillSeries` — zero-fills every key for every bucket. */
export function fillStackedSeries(
  rows: { day: string; key: string; count: number }[],
  range: Pick<InsightsRange, 'fromDay' | 'toDay' | 'granularity'>,
  keys: string[],
): StackedSeriesPoint[] {
  const byDay = new Map<string, Record<string, number>>();
  for (const row of rows) {
    const bucket = byDay.get(row.day) ?? {};
    bucket[row.key] = (bucket[row.key] ?? 0) + row.count;
    byDay.set(row.day, bucket);
  }
  const totalsByDay = new Map(
    [...byDay.entries()].map(([day, values]) => [
      day,
      Object.values(values).reduce((a, b) => a + b, 0),
    ]),
  );
  return fillSeries(totalsByDay, range).map(({ day }) => {
    const values = byDay.get(day) ?? {};
    return {
      day,
      values: Object.fromEntries(keys.map((k) => [k, values[k] ?? 0])),
    };
  });
}

/**
 * `backward` (rank drop) / `flip` (accepted<->rejected — equal rank) /
 * `forward` / `offPath` (either side isn't on `APPLICATION_STATUS_PATH`).
 */
export function classifyTransition(
  from: $Enums.ApplicationStatus,
  to: $Enums.ApplicationStatus,
): 'backward' | 'flip' | 'forward' | 'offPath' {
  const fromRank = getApplicationStatusRank(from);
  const toRank = getApplicationStatusRank(to);
  if (fromRank === null || toRank === null) return 'offPath';
  if (fromRank === toRank) return 'flip';
  return toRank < fromRank ? 'backward' : 'forward';
}

/** A non-option value renders as `other` only when the question allows it; else `retired`. */
export function classifyChoiceValue(
  value: string,
  options: readonly string[],
  allowOther: boolean,
): 'option' | 'other' | 'retired' {
  if (options.includes(value)) return 'option';
  return allowOther ? 'other' : 'retired';
}

export function meetsSample(n: number): boolean {
  return n >= INSIGHTS_MIN_SAMPLE;
}

/** "5 hours" under a day, else "3.2 days" — never both units at once. */
export function formatDuration(hours: number): string {
  if (hours < 24) {
    const rounded = Math.max(1, Math.round(hours));
    return `${rounded} ${rounded === 1 ? 'hour' : 'hours'}`;
  }
  return `${(hours / 24).toFixed(1)} days`;
}
