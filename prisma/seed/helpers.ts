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
 * UTC midnight of `now + days`, matching what getPositionAvailability assumes.
 */
export function utcDayOffset(now: Date, days: number): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days),
  );
}
