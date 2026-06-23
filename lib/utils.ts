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
