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

/**
 * UTC midnight of `now + days`. Every seeded position date goes through this
 * so a DB seeded today and one seeded next month land in the same relative
 * states — and so the date-only, UTC-midnight semantics
 * getPositionAvailability (lib/utils.ts) assumes are honored exactly.
 */
export function utcDayOffset(now: Date, days: number): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days),
  );
}
