import type { QuestionDef } from './types';

// Shared by both the global-question and per-position-question creation
// call sites in seed.ts, which otherwise duplicated this default-filling.
export function toQuestionCreateInput(q: QuestionDef, adminId: string) {
  return {
    ...q,
    required: q.required ?? true,
    options: q.options ?? [],
    createdById: adminId,
    updatedById: adminId,
  };
}
