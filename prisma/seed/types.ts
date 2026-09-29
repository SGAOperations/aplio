import type {
  ApplicationStatus,
  EmailStatus,
  EmailTemplateKey,
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
  // null models a user with no name at all — the name-gate scenario.
  name: string | null;
  isAdmin?: boolean;
  // Born deactivated, to exercise that path without a separate step.
  deactivated?: boolean;
  // Minutes before `now`. Omitted models "never signed in".
  lastLoginMinutesAgo?: number;
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
  // Overrides the applicant's current name in the submitted snapshot — the renamed-applicant scenario.
  applicantNameAtSubmit?: string;
  // Overrides defaultStatusTrail(status) — for a status reached by an unusual path.
  trail?: ApplicationStatus[];
  // Merged over positionAnswers[title] by question label.
  positionAnswerOverrides?: Record<string, string[]>;
}

export interface EmailLogDef {
  template: EmailTemplateKey;
  status: EmailStatus;
  to: string;
  userEmail?: string;
  application?: { applicantEmail: string; positionTitle: string };
  subject: string;
  hoursAgo: number;
  bounceType?: 'Permanent' | 'Transient';
  error?: string;
}
