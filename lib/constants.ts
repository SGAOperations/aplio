import { z } from 'zod/v4';

import { $Enums } from '@/prisma/client';
import type { PositionStatus, Prisma, QuestionType } from '@/prisma/client';

import type { PositionAvailability } from '@/lib/types';

import type { BadgeVariant } from '@/components/ui/badge';

export const QUESTION_TYPE_VALUES = [
  'short_answer',
  'long_answer',
  'single_choice',
  'multiple_choice',
  'file_upload',
] as const;

export type QuestionTypeValue = (typeof QUESTION_TYPE_VALUES)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionTypeValue, string> = {
  short_answer: 'Short Answer',
  long_answer: 'Long Answer',
  single_choice: 'Single Choice',
  multiple_choice: 'Multiple Choice',
  file_upload: 'File Upload',
};

// 'destructive' (error-only) and 'outline' (Required badge) deliberately unused here.
export const QUESTION_TYPE_BADGE_VARIANT: Record<QuestionType, BadgeVariant> = {
  short_answer: 'secondary',
  long_answer: 'info',
  single_choice: 'success',
  multiple_choice: 'warning',
  file_upload: 'default',
};

// Stays under Vercel's hard 4.5MB Function body limit (next.config.ts serverActions.bodySizeLimit).
export const FILE_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

// Must match the magic-byte signatures sniffed in lib/files.ts#sniffMimeType.
export const FILE_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
] as const;

export const FILE_UPLOAD_MIME_EXTENSIONS: Record<
  (typeof FILE_UPLOAD_MIME_TYPES)[number],
  string
> = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg' };

// Extensions and MIME types both listed — browsers filter on one or the other.
export const FILE_UPLOAD_ACCEPT =
  '.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg';

export const FILE_UPLOAD_HELP_TEXT = 'PDF, PNG or JPG · up to 4MB';

// Addressed by question, not answer-row id; FormData is all strings, so isGlobal needs coercion.
export const questionFileTargetSchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('profile'), questionId: z.string().min(1) }),
  z.object({
    scope: z.literal('application'),
    applicationId: z.string().min(1),
    questionId: z.string().min(1),
    isGlobal: z.boolean(),
  }),
]);

export const CHOICE_TYPES = ['single_choice', 'multiple_choice'] as const;
export type ChoiceType = (typeof CHOICE_TYPES)[number];

export const OTHER_OPTION_LABEL = 'Other';

// Distinct from OTHER_OPTION_LABEL: an admin option literally named "Other" can't collide.
export const OTHER_OPTION_VALUE = '__other__';

export const SHORT_ANSWER_FORMAT_VALUES = [
  'email',
  'phone_number',
  'url',
  'zip_code',
] as const;

export type ShortAnswerFormatValue =
  (typeof SHORT_ANSWER_FORMAT_VALUES)[number];

export const SHORT_ANSWER_FORMAT_LABELS: Record<
  ShortAnswerFormatValue,
  string
> = {
  email: 'Email',
  phone_number: 'Phone number',
  url: 'URL',
  zip_code: 'ZIP code',
};

export const SHORT_ANSWER_FORMAT_OPTIONS: {
  value: ShortAnswerFormatValue;
  label: string;
}[] = SHORT_ANSWER_FORMAT_VALUES.map((value) => ({
  value,
  label: SHORT_ANSWER_FORMAT_LABELS[value],
}));

// Deliberately permissive — never block a legitimate answer for RFC-grade strictness.
export const SHORT_ANSWER_FORMAT_PATTERNS: Record<
  ShortAnswerFormatValue,
  RegExp
> = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  // Optional + or 00 prefix, then digits with any mix of common separators.
  phone_number: /^(\+|00)?[\d\s().-]{7,20}$/,
  // Scheme and "www." optional; no nested quantifiers, to stay ReDoS-safe.
  url: /^(https?:\/\/)?(www\.)?[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(:\d+)?([/?#]\S*)?$/,
  // US ZIP shape only, not a general postal code.
  zip_code: /^\d{5}(-?\d{4})?$/,
};

export const SHORT_ANSWER_FORMAT_ERROR_MESSAGES: Record<
  ShortAnswerFormatValue,
  string
> = {
  email: 'Enter a valid email address',
  phone_number: 'Enter a valid phone number',
  url: 'Enter a valid URL (e.g. example.com or https://example.com)',
  zip_code: 'Enter a valid ZIP code',
};

// Trims first: the patterns are anchored, so pasted whitespace would falsely fail.
export function matchesShortAnswerFormat(
  value: string,
  format: ShortAnswerFormatValue,
): boolean {
  return SHORT_ANSWER_FORMAT_PATTERNS[format].test(value.trim());
}

export const baseQuestionSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  type: z.enum(QUESTION_TYPE_VALUES),
  required: z.boolean(),
  options: z.array(z.string()),
  allowOther: z.boolean(),
  format: z.enum(SHORT_ANSWER_FORMAT_VALUES).nullable(),
});

// Rejects a format on a non-short-answer question as a field error, never silently.
export function validateShortAnswerFormat(
  data: { type: string; format: ShortAnswerFormatValue | null },
  ctx: z.RefinementCtx,
) {
  if (data.format !== null && data.type !== 'short_answer') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['format'],
      message: 'Format is only available for short-answer questions',
    });
  }
}

// Choice types need ≥1 option; non-choice types must carry none/no allowOther (orphaned data else).
export function validateOptions(
  data: { type: string; options: string[]; allowOther: boolean },
  ctx: z.RefinementCtx,
) {
  const isChoice = CHOICE_TYPES.includes(
    data.type as (typeof CHOICE_TYPES)[number],
  );
  if (isChoice && data.options.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['options'],
      message: 'At least one option is required for choice questions',
    });
  }
  if (!isChoice && data.options.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['options'],
      message: 'Options are not allowed for this question type',
    });
  }
  if (!isChoice && data.allowOther) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['allowOther'],
      message: "'Other' is only available for choice questions",
    });
  }
}

export const questionFormSchema = baseQuestionSchema
  .superRefine(validateOptions)
  .superRefine(validateShortAnswerFormat);

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

// Excludes 'withdrawn': no consumer needs the unfiltered status list.
export const APPLICATION_STATUS_VALUES = [
  'draft',
  'applied',
  'reached_out',
  'interview_scheduled',
  'reviewing',
  'accepted',
  'rejected',
] as const satisfies $Enums.ApplicationStatus[];

export const APPLICATION_STATUS_OPTIONS: {
  value: $Enums.ApplicationStatus;
  label: string;
}[] = APPLICATION_STATUS_VALUES.map((value) => ({
  value,
  label: APPLICATION_STATUS_LABELS[value],
}));

// Reviewer can't set 'draft' (applicant-owned); literal tuple so z.enum() infers without a cast.
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

export const REVIEWER_APPLICATION_STATUS_OPTIONS =
  APPLICATION_STATUS_OPTIONS.filter((o) => o.value !== 'draft');

// States a reviewer may not act *on*, unlike REVIEWER_APPLICATION_STATUSES (may set *to*).
export const NON_REVIEWABLE_APPLICATION_STATUSES = [
  'draft',
  'withdrawn',
] as const satisfies $Enums.ApplicationStatus[];

// Positive list: a future enum value stays excluded until added — safer for this metric.
export const UNRESOLVED_APPLICATION_STATUSES = [
  'applied',
  'reached_out',
  'interview_scheduled',
  'reviewing',
] as const satisfies $Enums.ApplicationStatus[];

// Distinct from NON_REVIEWABLE_APPLICATION_STATUSES — same members, different meaning.
export const APPLICANT_EDITABLE_APPLICATION_STATUSES = [
  'draft',
  'withdrawn',
] as const satisfies $Enums.ApplicationStatus[];

// Includes 'draft' (unlike UNRESOLVED): a draft-only applicant still needs attention.
export const NON_TERMINAL_APPLICATION_STATUSES = [
  'draft',
  'applied',
  'reached_out',
  'interview_scheduled',
  'reviewing',
] as const satisfies $Enums.ApplicationStatus[];

// No status history, so a withdraw → re-open round-trip would launder the decision.
export const TERMINAL_DECISION_STATUSES: readonly $Enums.ApplicationStatus[] = [
  'accepted',
  'rejected',
];

export const RECENTLY_CLOSED_WINDOW_DAYS = 7;

// Longer than the public window so managers and admins keep oversight during wrap-up.
export const MANAGED_POSITIONS_WINDOW_DAYS = 30;

export const STATUS_VALUES = [
  'draft',
  'open',
  'closed',
] as const satisfies PositionStatus[];

export const STATUS_LABELS: Record<PositionStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
};

export const STATUS_OPTIONS: { value: PositionStatus; label: string }[] =
  STATUS_VALUES.map((value) => ({ value, label: STATUS_LABELS[value] }));

// Mirrors createPositionSchema/updatePositionSchema — keep the shapes in sync.
export const positionFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string(),
  status: z.enum(STATUS_VALUES),
  opensAt: z.string().optional(),
  closesAt: z.string().optional(),
});

export const STATUS_VARIANTS: Record<PositionStatus, BadgeVariant> = {
  draft: 'secondary',
  open: 'default',
  closed: 'outline',
};

// Position-scoped surfaces (draft still shows its applications); PUBLISHED is for cross-position ones.
export const VISIBLE_POSITION_WHERE = {
  deletedAt: null,
} satisfies Prisma.PositionWhereInput;

export const PUBLISHED_POSITION_WHERE = {
  deletedAt: null,
  status: { not: 'draft' },
} satisfies Prisma.PositionWhereInput;

export const QUESTION_TYPE_OPTIONS: { value: QuestionType; label: string }[] =
  QUESTION_TYPE_VALUES.map((value) => ({
    value,
    label: QUESTION_TYPE_LABELS[value],
  }));

// Mirrors STATUS_LABELS 'open'/'closed' so the badge reflects effective state, not the raw enum.
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

export const PRIVACY_HREF = '/privacy';
export const TERMS_HREF = '/terms';

export const createUserSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  name: z.string().trim().optional(),
  isAdmin: z.boolean().default(false),
});

// Maximum character length for a user's full name — shared between the zod schema
// in the server action and the client-side NameField component.
export const NAME_MAX_LENGTH = 100;

// Name validation shared between the server action and the client form so
// they can't drift apart (ENGINEERING §1: abstract at 2+ occurrences).
export const nameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter your full name.')
    .max(
      NAME_MAX_LENGTH,
      `Name must be ${NAME_MAX_LENGTH} characters or fewer.`,
    ),
});

export const STATUS_BADGE_VARIANT_TO_DOT: Record<BadgeVariant, string> = {
  info: 'bg-info',
  warning: 'bg-warning',
  success: 'bg-success',
  destructive: 'bg-destructive',
  secondary: 'bg-muted-foreground',
  default: 'bg-primary',
  outline: 'bg-border',
};

// Order is meaningful — rendered left to right on position cards.
export const POSITION_CARD_STAT_STATUSES = [
  'applied',
  'interview_scheduled',
  'accepted',
  'rejected',
] as const satisfies $Enums.ApplicationStatus[];
