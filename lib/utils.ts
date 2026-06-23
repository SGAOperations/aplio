import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import type { PositionStatus } from '@/prisma/client';

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

// Minimal structural type for the position-window helper. Satisfied by
// PositionWithQuestions, PositionForEdit, and raw Prisma rows — no conversion needed.
export type PositionWindow = {
  status: PositionStatus;
  opensAt: Date | null;
  closesAt: Date | null;
};

// Applicant-facing availability states derived from status + date window.
// 'unavailable' covers draft/closed positions (status is the master switch).
export type PositionAvailability =
  | 'accepting'
  | 'upcoming'
  | 'closed_by_date'
  | 'unavailable';

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
    // End-of-day for closesAt: advance to the next calendar day and subtract 1ms.
    const endOfCloseDay = new Date(position.closesAt);
    endOfCloseDay.setDate(endOfCloseDay.getDate() + 1);
    endOfCloseDay.setMilliseconds(endOfCloseDay.getMilliseconds() - 1);
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
