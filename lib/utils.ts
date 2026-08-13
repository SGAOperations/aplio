import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { MANAGED_POSITIONS_WINDOW_DAYS } from '@/lib/constants';
import type {
  PositionActivity,
  PositionAvailability,
  PositionWindow,
} from '@/lib/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type ErrorType = { error: string };

export type ResponseType<T> = T | ErrorType;

export function isError<T>(result: ResponseType<T>): result is ErrorType {
  return (
    result !== null &&
    result !== undefined &&
    typeof result === 'object' &&
    'error' in result
  );
}

/**
 * Default-DENY: an unset VERCEL_ENV also describes production off Vercel.
 */
export function isBypassAllowed(): boolean {
  return (
    process.env.VERCEL_ENV === 'development' ||
    process.env.VERCEL_ENV === 'preview'
  );
}

export function toStringArray(v: unknown): string[] {
  if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return v;
  return [];
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/**
 * Buckets to "Nm/Nh/Nd ago", falling back to formatDate beyond a week.
 */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(date);
}

/**
 * closesAt is inclusive of its whole day; `now > closesAt` would close it at midnight.
 */
export function getPositionAvailability(
  position: PositionWindow,
  now: Date = new Date(),
): PositionAvailability {
  if (position.status !== 'open') return 'unavailable';

  if (position.opensAt !== null && now < position.opensAt) return 'upcoming';

  if (position.closesAt !== null) {
    // Next UTC day minus 1ms → 23:59:59.999 UTC, explicit to stay host-timezone-proof.
    const endOfCloseDay = new Date(
      Date.UTC(
        position.closesAt.getUTCFullYear(),
        position.closesAt.getUTCMonth(),
        position.closesAt.getUTCDate() + 1,
      ) - 1,
    );
    if (now > endOfCloseDay) return 'closed_by_date';
  }

  return 'accepting';
}

export function isAcceptingApplications(
  position: PositionWindow,
  now?: Date,
): boolean {
  return getPositionAvailability(position, now) === 'accepting';
}

/**
 * Single source of truth for "still worth a manager's attention" — used to
 * partition the /positions manager list into active vs archived, AND (#360)
 * to freeze edits on a managed position. A second implementation of this
 * predicate is an authorization bug, not just a display bug.
 *
 * Active when any of:
 *   1. the position is not actually closed — draft, open-and-accepting, and
 *      open-and-upcoming are always active. "Closed" is the same effective
 *      state PositionStatusBadge and getRecentlyClosedPositions use: status
 *      literally 'closed', OR status 'open' with closesAt already past
 *      (getPositionAvailability's 'closed_by_date') — the status column does
 *      not auto-flip to 'closed' when closesAt elapses, so checking the raw
 *      `status` field alone would leave date-closed positions active forever.
 *   2. position._count.applications > 0 — an in-flight (non-terminal) application
 *      keeps a position active regardless of status, deliberately unscoped per
 *      the ACs (an old closed position with a lingering draft still needs attention).
 *   3. otherwise, (closesAt ?? updatedAt) is within MANAGED_POSITIONS_WINDOW_DAYS
 *      of `now` — same cutoff arithmetic getManagedPositions used before this
 *      predicate existed, so closed-position behavior is unchanged.
 *
 * `now` is injectable for deterministic testing.
 */
export function isPositionActive(
  position: PositionActivity,
  now: Date = new Date(),
): boolean {
  const isClosed =
    position.status === 'closed' ||
    getPositionAvailability(position, now) === 'closed_by_date';
  if (!isClosed) return true;
  if (position._count.applications > 0) return true;

  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - MANAGED_POSITIONS_WINDOW_DAYS);
  const recency = position.closesAt ?? position.updatedAt;
  return recency >= cutoff;
}

interface FormatTableCountOptions {
  shown: number;
  total: number;
  /** Singular noun; pluralized by appending "s" unless `pluralNoun` is given. */
  noun: string;
  pluralNoun?: string;
  /** Displays the shown count as "100+" when the query capped it. */
  shownCapped?: boolean;
  /** When false, collapses to "{total} {noun}" even if shown and total differ. */
  isFiltered?: boolean;
}

/**
 * Bare count when nothing is hidden, "{shown} / {total}" when the table is truncated.
 */
export function formatTableCount({
  shown,
  total,
  noun,
  pluralNoun,
  shownCapped = false,
  isFiltered = false,
}: FormatTableCountOptions): string {
  const plural = pluralNoun ?? `${noun}s`;
  const nounLabel = total === 1 ? noun : plural;
  const shownLabel = shownCapped ? '100+' : String(shown);

  if (!isFiltered && !shownCapped) return `${total} ${nounLabel}`;
  return `${shownLabel} / ${total} ${nounLabel}`;
}
