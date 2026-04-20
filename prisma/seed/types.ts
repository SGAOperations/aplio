import type { QuestionType } from '../client';

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
