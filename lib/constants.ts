import { z } from 'zod/v4';

import { $Enums } from '@/prisma/client';
import type { PositionStatus, QuestionType } from '@/prisma/client';

import type { PositionAvailability } from '@/lib/types';

import type { BadgeVariant } from '@/components/ui/badge';

export const QUESTION_TYPE_VALUES = [
  'short_answer',
  'long_answer',
  'single_choice',
  'multiple_choice',
] as const;

export type QuestionTypeValue = (typeof QUESTION_TYPE_VALUES)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionTypeValue, string> = {
  short_answer: 'Short Answer',
  long_answer: 'Long Answer',
  single_choice: 'Single Choice',
  multiple_choice: 'Multiple Choice',
};

// Choice-type question types that require at least one option.
export const CHOICE_TYPES = ['single_choice', 'multiple_choice'] as const;
export type ChoiceType = (typeof CHOICE_TYPES)[number];

// Base question schema shared between the client form and server actions.
// Both sides extend this with `.superRefine` to enforce options constraints.
export const baseQuestionSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  type: z.enum(QUESTION_TYPE_VALUES),
  required: z.boolean(),
  options: z.array(z.string()),
});

// Human-readable labels for each application status.
// Keyed on the generated ApplicationStatus enum for build-time exhaustiveness.
export const APPLICATION_STATUS_LABELS: Record<
  $Enums.ApplicationStatus,
  string
> = {
  draft: 'Draft',
  applied: 'Applied',
  reached_out: 'Reached out',
  interview_scheduled: 'Interview scheduled',
  reviewing: 'Reviewing',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

// Badge variant for each application status, using design-system tokens.
export const APPLICATION_STATUS_BADGE_VARIANT: Record<
  $Enums.ApplicationStatus,
  BadgeVariant
> = {
  draft: 'secondary',
  applied: 'info',
  reached_out: 'info',
  interview_scheduled: 'info',
  reviewing: 'warning',
  accepted: 'success',
  rejected: 'destructive',
  withdrawn: 'outline',
};

// Tuple of all ApplicationStatus values — shared between zod enum (action) and
// the Select options (control) so both stay in sync with the DB enum.
export const APPLICATION_STATUS_VALUES = [
  'draft',
  'applied',
  'reached_out',
  'interview_scheduled',
  'reviewing',
  'accepted',
  'rejected',
] as const satisfies $Enums.ApplicationStatus[];

// Select options for the status dropdown — one entry per APPLICATION_STATUS_LABELS entry,
// mirroring STATUS_OPTIONS for positions.
export const APPLICATION_STATUS_OPTIONS: {
  value: $Enums.ApplicationStatus;
  label: string;
}[] = APPLICATION_STATUS_VALUES.map((value) => ({
  value,
  label: APPLICATION_STATUS_LABELS[value],
}));

// Reviewer-selectable statuses exclude 'draft' — a reviewer cannot push an
// application back to draft; that state is applicant-owned. Written as a
// literal tuple so z.enum() infers the correct union without an unsafe cast.
// Used in the single-update action, the bulk-update action, and both status
// controls — extracted here (ENGINEERING §1: abstract at 2+).
export const REVIEWER_APPLICATION_STATUSES = [
  'applied',
  'reached_out',
  'interview_scheduled',
  'reviewing',
  'accepted',
  'rejected',
] as const satisfies [
  Exclude<$Enums.ApplicationStatus, 'draft'>,
  ...Exclude<$Enums.ApplicationStatus, 'draft'>[],
];

// Reviewer-facing Select options — draft excluded.
export const REVIEWER_APPLICATION_STATUS_OPTIONS =
  APPLICATION_STATUS_OPTIONS.filter((o) => o.value !== 'draft');

// Submitted-but-not-concluded application statuses. Excludes 'draft' (unsubmitted,
// applicant-owned), 'accepted'/'rejected' (terminal), and 'withdrawn' (resolved).
// Used by the admin positions query to keep a closed position visible only while
// it still has work in progress. Positive 'in' list so future enum values are
// excluded by default until deliberately added — safer for a visibility metric.
export const UNRESOLVED_APPLICATION_STATUSES = [
  'applied',
  'reached_out',
  'interview_scheduled',
  'reviewing',
] as const satisfies $Enums.ApplicationStatus[];

// Non-terminal application statuses — all statuses except 'accepted', 'rejected',
// and 'withdrawn'. Intentionally includes 'draft' (unlike UNRESOLVED_APPLICATION_STATUSES),
// because a managed position with a draft-only applicant still warrants attention.
// Used to determine whether a managed position is still relevant for managers.
export const NON_TERMINAL_APPLICATION_STATUSES = [
  'draft',
  'applied',
  'reached_out',
  'interview_scheduled',
  'reviewing',
] as const satisfies $Enums.ApplicationStatus[];

// Window (in days) for the "Recently Closed" positions section.
// Positions closed within this window appear in that section.
export const RECENTLY_CLOSED_WINDOW_DAYS = 7;

// Window (in days) for the managed/admin positions visibility filter.
// Closed positions remain visible to managers and admins for longer than the
// public "Recently Closed" section so they retain oversight during wrap-up.
export const MANAGED_POSITIONS_WINDOW_DAYS = 30;

export const STATUS_OPTIONS: { value: PositionStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
];

export const STATUS_LABELS: Record<PositionStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
};

export const STATUS_VARIANTS: Record<PositionStatus, BadgeVariant> = {
  draft: 'secondary',
  open: 'default',
  closed: 'outline',
};

export const QUESTION_TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'long_answer', label: 'Long Answer' },
  { value: 'single_choice', label: 'Single Choice' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
];

// Human-readable labels for each computed availability state.
// 'accepting'/'closed_by_date' intentionally mirror STATUS_LABELS 'open'/'closed' so
// the admin badge reflects the effective state rather than the raw DB status enum.
export const AVAILABILITY_LABELS: Record<PositionAvailability, string> = {
  accepting: 'Open',
  upcoming: 'Upcoming',
  closed_by_date: 'Closed',
  unavailable: 'Closed',
};

export const AVAILABILITY_VARIANTS: Record<PositionAvailability, BadgeVariant> =
  {
    accepting: 'default',
    upcoming: 'secondary',
    closed_by_date: 'outline',
    unavailable: 'outline',
  };

// Public URLs for the legal pages — referenced from the login footer, app footer,
// and each legal page's cross-link footer. One edit when the URLs change.
export const PRIVACY_HREF = '/privacy';
export const TERMS_HREF = '/terms';

// Maps badge variant to a design-token dot color used in stat cards and the
// activity feed. Extracted from pipeline-summary.tsx so both consumers share
// one source of truth (ENGINEERING §1: abstract at 2+).
export const STATUS_BADGE_VARIANT_TO_DOT: Record<string, string> = {
  info: 'bg-info',
  warning: 'bg-warning',
  success: 'bg-success',
  destructive: 'bg-destructive',
  secondary: 'bg-muted-foreground',
  default: 'bg-primary',
  outline: 'bg-border',
};
