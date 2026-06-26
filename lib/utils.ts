import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import type { PositionAvailability, PositionWindow } from '@/lib/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Type definitions for server action responses
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
 * Returns a human-readable relative time string for a past date.
 * Rules: <1 min → "Just now"; <60 min → "Nm ago"; <24 h → "Nh ago";
 * <7 d → "Nd ago"; otherwise falls back to formatDate.
 * `now` is injectable for deterministic testing.
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
 * Derives the applicant-facing availability of a position.
 *
 * Date semantics (important — positions use date-only inputs):
 *   - opensAt  → start-of-day: position opens at the beginning of opensAt day.
 *   - closesAt → inclusive of its whole day: the stored midnight value means the
 *     position is available *through* that day, so we compare against end-of-day
 *     (23:59:59.999). A naive `now > closesAt` would close it at midnight on the
 *     chosen day; inclusive end-of-day honors user intent ("open through Jun 30").
 *
 * `now` defaults to `new Date()` but is injectable for testing and so callers
 * within a single action can pass a consistent timestamp.
 */
export function getPositionAvailability(
  position: PositionWindow,
  now: Date = new Date(),
): PositionAvailability {
  if (position.status !== 'open') return 'unavailable';

  if (position.opensAt !== null && now < position.opensAt) return 'upcoming';

  if (position.closesAt !== null) {
    // End-of-day for closesAt: UTC-explicit to stay timezone-proof on any host.
    // Advance to the next UTC calendar day and subtract 1ms → 23:59:59.999 UTC.
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

/** Convenience boolean: returns true only when the position is in the 'accepting' state. */
export function isAcceptingApplications(
  position: PositionWindow,
  now?: Date,
): boolean {
  return getPositionAvailability(position, now) === 'accepting';
}

interface FormatTableCountOptions {
  shown: number;
  total: number;
  /** Singular noun, e.g. "application". Pluralized by appending "s" unless `pluralNoun` is given. */
  noun: string;
  /** Override the plural form if it is not simply `noun + "s"`. */
  pluralNoun?: string;
  /**
   * Set to true when the shown count is capped (e.g. `getApplications` caps at 100)
   * so the display reads "100+" rather than a misleadingly exact number.
   */
  shownCapped?: boolean;
}

/**
 * Formats a table row count for display in a toolbar.
 *
 * When shown === total returns "{total} {noun}" (no redundant x/x).
 * When filtered returns "{shown} / {total} {noun}".
 * When shownCapped and shown === total (capped threshold) uses "100+" for shown side.
 */
export function formatTableCount({
  shown,
  total,
  noun,
  pluralNoun,
  shownCapped = false,
}: FormatTableCountOptions): string {
  const plural = pluralNoun ?? `${noun}s`;
  const nounLabel = total === 1 ? noun : plural;
  const shownLabel = shownCapped ? '100+' : String(shown);

  if (shown === total) return `${shownLabel} ${nounLabel}`;
  return `${shownLabel} / ${total} ${nounLabel}`;
}
