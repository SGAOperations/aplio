import { toOrgDayString } from '@/lib/dates';

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
  const [year, month, date] = toOrgDayString(now).split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, date + days));
  return shifted.toISOString().slice(0, 10);
}
