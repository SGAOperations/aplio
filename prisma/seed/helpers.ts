import { toOrgDayString } from '@/lib/dates';

import type { ApplicationStatus } from '../client';
import type { QuestionDef } from './types';

export function toQuestionCreateInput(q: QuestionDef, adminId: string) {
  return {
    ...q,
    required: q.required ?? true,
    options: q.options ?? [],
    allowOther: q.allowOther ?? false,
    createdById: adminId,
    updatedById: adminId,
  };
}

/** UTC midnight of `now + days` — a genuine instant, used for submittedAt. */
export function utcDayOffset(now: Date, days: number): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days),
  );
}

/**
 * `now`'s org calendar day, offset by `days`, as `YYYY-MM-DD` — for
 * orgDayStart/orgDayEnd, so seeded windows carry no drift across a DST boundary.
 * Calendar arithmetic only: never round-trips through a UTC instant, which
 * would land on the wrong org-local day depending on the season.
 */
export function orgDayOffset(now: Date, days: number): string {
  const [year, month, date] = toOrgDayString(now).split('-').map(Number) as [
    number,
    number,
    number,
  ];
  const shifted = new Date(Date.UTC(year, month - 1, date + days));
  return shifted.toISOString().slice(0, 10);
}

/** `now - minutes` — a genuine instant, for lastLoginAt. */
export function minutesAgo(now: Date, minutes: number): Date {
  return new Date(now.getTime() - minutes * 60 * 1000);
}

// draft/withdrawn are applicant moves, off isAllowedApplicationStatusTransition's
// reviewer graph — see tests/unit/seed-helpers.test.ts for that split.
export function defaultStatusTrail(
  status: ApplicationStatus,
): ApplicationStatus[] {
  switch (status) {
    case 'draft':
      return [];
    case 'applied':
      return ['applied'];
    case 'reached_out':
      return ['applied', 'reached_out'];
    case 'interview_scheduled':
      return ['applied', 'reached_out', 'interview_scheduled'];
    case 'reviewing':
      return ['applied', 'reached_out', 'interview_scheduled', 'reviewing'];
    case 'accepted':
      return [
        'applied',
        'reached_out',
        'interview_scheduled',
        'reviewing',
        'accepted',
      ];
    case 'rejected':
      return ['applied', 'reached_out', 'rejected'];
    case 'withdrawn':
      return ['applied', 'withdrawn'];
    default: {
      const exhaustiveCheck: never = status;
      throw new Error(`Unhandled application status: ${exhaustiveCheck}`);
    }
  }
}

/**
 * `count` instants from `start` to `end`, first pinned to `start`. Falls
 * back to one-minute spacing when `end` doesn't leave room to spread into.
 */
export function spreadTrailInstants(
  start: Date,
  end: Date,
  count: number,
): Date[] {
  if (count <= 0) return [];
  if (count === 1) return [start];

  const spanMs = end.getTime() - start.getTime();
  if (spanMs <= 0)
    return Array.from(
      { length: count },
      (_, i) => new Date(start.getTime() + i * 60_000),
    );

  const stepMs = spanMs / (count - 1);
  return Array.from(
    { length: count },
    (_, i) => new Date(start.getTime() + i * stepMs),
  );
}
