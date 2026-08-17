import type {
  ApplicationStatus,
  PositionStatus,
  QuestionType,
} from '../client';

// Hand-rolled: spans GlobalQuestion and PositionQuestion, which Prisma can't.
export interface QuestionDef {
  order: number;
  label: string;
  type: QuestionType;
  required?: boolean;
  options?: string[];
  allowOther?: boolean;
}

export interface PositionDef {
  title: string;
  description: string;
  status: PositionStatus;
  // Day offsets from `now`. Tri-state: null means unbounded, 0 means today.
  opensInDays?: number | null;
  closesInDays?: number | null;
  // Soft-deleted (deletedAt set) — invisible everywhere regardless of status.
  deleted?: boolean;
  managerEmails?: string[];
  questions: QuestionDef[];
}

export interface ApplicantDef {
  email: string;
  name: string;
  isAdmin?: boolean;
  // Born deactivated, to exercise that path without a separate step.
  deactivated?: boolean;
}

export type ApplicationAnswerMode = 'full' | 'partial' | 'none';

export interface ApplicationDef {
  applicantEmail: string;
  positionTitle: string;
  status: ApplicationStatus;
  // Days before `now`. Omitted for drafts, which keep the schema default.
  submittedInDays?: number;
  // 'partial' mirrors createDraftApplication: profile answers copied, position blank.
  answers: ApplicationAnswerMode;
}
