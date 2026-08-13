import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import type { PositionAvailability, PositionWindow } from '@/lib/types';

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
 * Default-DENY: an unset VERCEL_ENV must not enable bypass, since that also
 * describes a production deployment hosted anywhere other than Vercel.
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
 * Buckets to "Just now"/"Nm ago"/"Nh ago"/"Nd ago", falling back to formatDate
 * beyond a week.
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
 * Positions store date-only values: closesAt is inclusive of its whole day, so a
 * naive `now > closesAt` would close a position at midnight of the chosen day.
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
 * "{total} {noun}" when nothing is hidden, otherwise "{shown} / {total} {noun}" —
 * a truncated table should say so.
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
