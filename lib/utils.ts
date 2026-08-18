import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { MANAGED_POSITIONS_WINDOW_DAYS } from '@/lib/constants';
import type {
  AnswerPartition,
  AnswerQuestion,
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
 * Re-thrown from a server action's `{ error }` result; its message is user-facing.
 */
export class ActionError extends Error {}

/**
 * Default-DENY: an unset VERCEL_ENV also describes production off Vercel.
 * Single gate for both issuing and accepting the bypass cookie; preview stays
 * allowed by design (per-PR Neon branch, not production data).
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

/** Joins truthy ids for `aria-describedby`; `undefined` when none apply. */
export function composeDescribedBy(
  ...ids: Array<string | false | null | undefined>
): string | undefined {
  return ids.filter((v): v is string => Boolean(v)).join(' ') || undefined;
}

/** Splits a stored answer into what still fits the question's shape (`fitted`) vs. what doesn't (`orphaned`); together always `value`. */
export function partitionAnswerValue(
  question: AnswerQuestion,
  value: string[],
): AnswerPartition {
  switch (question.type) {
    case 'short_answer':
    case 'long_answer':
    case 'file_upload':
      return { fitted: value.slice(0, 1), orphaned: value.slice(1) };

    case 'single_choice': {
      // entry 0 renders either as an option or as the "Other" text.
      if (question.allowOther)
        return { fitted: value.slice(0, 1), orphaned: value.slice(1) };

      const fittedIndex = value.findIndex((v) => question.options.includes(v));
      if (fittedIndex === -1) return { fitted: [], orphaned: value };
      return {
        fitted: [value[fittedIndex]],
        orphaned: [
          ...value.slice(0, fittedIndex),
          ...value.slice(fittedIndex + 1),
        ],
      };
    }

    case 'multiple_choice': {
      const inOptions = value.filter((v) => question.options.includes(v));
      const notInOptions = value.filter((v) => !question.options.includes(v));
      if (!question.allowOther)
        return { fitted: inOptions, orphaned: notInOptions };

      // Checked options plus first non-option entry ("Other" text); rest orphaned.
      const [otherValue, ...restOrphaned] = notInOptions;
      return {
        fitted:
          otherValue !== undefined ? [...inOptions, otherValue] : inOptions,
        orphaned: restOrphaned,
      };
    }

    default: {
      // Unreachable — a new type breaks the build via `never`, not silently at runtime.
      const exhaustiveCheck: never = question.type;
      return exhaustiveCheck;
    }
  }
}

/** True when the stored answer has any part that still fits the question's current shape. */
export function isAnswered(question: AnswerQuestion, value: string[]): boolean {
  return partitionAnswerValue(question, value).fitted.length > 0;
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
 * Single source of truth for active vs archived — a second implementation is
 * an authorization bug, not just a display bug.
 *
 * Active unless closed (status 'closed', or 'open' past closesAt) AND has no
 * unresolved applications AND is outside the recency window. A lingering
 * 'draft' never counts — it can't be submitted to an already-closed position,
 * so counting it would pin the position active forever.
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
