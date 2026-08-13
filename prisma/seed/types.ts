import type {
  ApplicationStatus,
  PositionStatus,
  QuestionType,
} from '../client';

// Hand-rolled because it spans both GlobalQuestion and PositionQuestion; deriving
// from Prisma would mean two near-duplicate per-model types.
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
  // Day offsets from the seed run's `now`, resolved via utcDayOffset. `null`/
  // omitted means no date on that end of the window (an always-open start or
  // an unbounded close), which is a different state than "opens/closes today"
  // (offset 0) — so this stays tri-state rather than defaulting to a number.
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
  // Present only for the three dev-bypass identities — the seed upserts on
  // this (create-only) instead of `create`-ing, so a DB where someone already
  // bypass-logged-in still seeds without a unique-constraint collision.
  neonAuthId?: string;
  isAdmin?: boolean;
  // Sets deletedAt/deletedById on creation — exercises the deactivated-user
  // path (auth resolution, admin user list) without a separate deactivate step.
  deactivated?: boolean;
}

export type ApplicationAnswerMode = 'full' | 'partial' | 'none';

export interface ApplicationDef {
  applicantEmail: string;
  positionTitle: string;
  status: ApplicationStatus;
  // Days before `now` the application was submitted. Omitted for drafts,
  // which keep the schema default for submittedAt (non-nullable; overwritten
  // by submitApplication once actually submitted).
  submittedInDays?: number;
  // 'full' = every global + position question answered; 'partial' = global
  // (profile) answers copied but position questions left blank, as
  // createDraftApplication does; 'none' = no answers at all.
  answers: ApplicationAnswerMode;
}
