import type { QuestionDef } from './types';

export function toQuestionCreateInput(q: QuestionDef, adminId: string) {
  return {
    ...q,
    required: q.required ?? true,
    options: q.options ?? [],
    createdById: adminId,
    updatedById: adminId,
  };
}
