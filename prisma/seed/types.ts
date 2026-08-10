import type { QuestionType } from '../client';

// Hand-rolled rather than derived from a single Prisma `*CreateManyInput`
// because this shape is shared across two different models
// (GlobalQuestion and PositionQuestion) — deriving per-model Omit<> types
// would just produce two near-duplicate types for no benefit.
export interface QuestionDef {
  order: number;
  label: string;
  type: QuestionType;
  required?: boolean;
  options?: string[];
}

export interface PositionDef {
  title: string;
  description: string;
  questions: QuestionDef[];
}
