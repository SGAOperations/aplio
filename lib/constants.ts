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

// Keyed on the generated QuestionType enum (not QUESTION_TYPE_VALUES) for build-time
// exhaustiveness. Excludes 'destructive' (error-only) and 'outline' (used by the
// adjacent Required badge).
export const QUESTION_TYPE_BADGE_VARIANT: Record<QuestionType, BadgeVariant> = {
  short_answer: 'secondary',
  long_answer: 'info',
  single_choice: 'success',
  multiple_choice: 'warning',
  file_upload: 'default',
};

// App-wide file-upload constraints (v1: fixed, not per-question configurable).
// 4MB stays safely under Vercel's hard 4.5MB Function body limit (see
// next.config.ts's serverActions.bodySizeLimit).
export const FILE_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

// Allow-listed MIME types — must match the magic-byte signatures sniffed in
// lib/files.ts#sniffMimeType so client copy and server enforcement agree.
export const FILE_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
] as const;

// Maps a sniffed MIME type to its canonical extension for stored pathnames.
export const FILE_UPLOAD_MIME_EXTENSIONS: Record<
  (typeof FILE_UPLOAD_MIME_TYPES)[number],
  string
> = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg' };

// `accept` attribute for the file input — extensions plus MIME types so both
// browser-native filtering paths are covered.
export const FILE_UPLOAD_ACCEPT =
  '.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg';

export const FILE_UPLOAD_HELP_TEXT = 'PDF, PNG or JPG · up to 4MB';

// Discriminated-union target a file answer belongs to — addressed by question,
// not by answer row id, mirroring createOrUpdateApplicationAnswer's existing
// (applicationId, questionId, isGlobal) addressing. FormData always arrives as
// strings, so callers must coerce isGlobal from 'true'/'false' before parsing.
export const questionFileTargetSchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('profile'), questionId: z.string().min(1) }),
  z.object({
    scope: z.literal('application'),
    applicationId: z.string().min(1),
    questionId: z.string().min(1),
    isGlobal: z.boolean(),
  }),
]);

// Choice-type question types that require at least one option.
export const CHOICE_TYPES = ['single_choice', 'multiple_choice'] as const;
export type ChoiceType = (typeof CHOICE_TYPES)[number];

// Label for the virtual "Other" choice appended to choice-type questions when
// allowOther is enabled — shared by both applicant-facing renderers so there is
// one string, not two hardcoded copies (ENGINEERING §1: abstract at 2+).
export const OTHER_OPTION_LABEL = 'Other';

// Sentinel used only for RadioGroup/RadioGroupItem value comparisons on the
// virtual "Other" choice — kept distinct from OTHER_OPTION_LABEL so an
// admin-authored option literally named "Other" can never collide with the
// virtual choice (see PR #334 review).
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

// Single source of truth for each format preset's validation pattern — shared
// by client (inline blur validation) and server (re-validation on save) so
// they can never drift. Intentionally permissive: favor not blocking a
// legitimate answer over strict/RFC-grade enforcement, and each pattern
// accepts multiple real-world variants of its format rather than one
// canonical shape (see human feedback on PR #333).
export const SHORT_ANSWER_FORMAT_PATTERNS: Record<
  ShortAnswerFormatValue,
  RegExp
> = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  // Optional leading + (country code) or 00 international prefix, then digits
  // with any mix of spaces, dots, hyphens, and parens as separators — covers
  // "555-123-4567", "(555) 123-4567", "555.123.4567", "+1 555 123 4567", and
  // "00 44 20 7946 0958" without requiring a single canonical layout.
  phone_number: /^(\+|00)?[\d\s().-]{7,20}$/,
  // Scheme (http/https) and "www." are both optional so a bare domain like
  // "google.com" or a "www."-prefixed host passes alongside a full
  // "https://google.com/path" URL — only the host needs a dot-separated
  // label plus a TLD; no nested quantifiers, to keep this ReDoS-safe.
  url: /^(https?:\/\/)?(www\.)?[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(:\d+)?([/?#]\S*)?$/,
  // 5-digit ZIP, ZIP+4 with or without the hyphen (some autofill/paste
  // sources omit it) — still US ZIP-shaped, not a general postal code.
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

// Single source of truth for testing a value against a format preset — trims
// before matching since every pattern above is anchored against character
// classes that exclude (or only tolerate mid-string) whitespace, so a
// legitimate pasted value with incidental leading/trailing whitespace must
// not be rejected. Shared by every call site (client blur checks, server
// re-validation) so none can drift and re-introduce the untrimmed check.
export function matchesShortAnswerFormat(
  value: string,
  format: ShortAnswerFormatValue,
): boolean {
  return SHORT_ANSWER_FORMAT_PATTERNS[format].test(value.trim());
}

// Base question schema shared between the client form and server actions.
// Both sides extend this with `.superRefine` to enforce options/format constraints.
export const baseQuestionSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  type: z.enum(QUESTION_TYPE_VALUES),
  required: z.boolean(),
  options: z.array(z.string()),
  allowOther: z.boolean(),
  format: z.enum(SHORT_ANSWER_FORMAT_VALUES).nullable(),
});

// Shared superRefine used by both the admin dialogs and the server actions
// (no 'use server' boundary here) so a format set on a non-short-answer
// question is always rejected as a zod field error, never silently persisted.
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

// Enforces that choice-type questions carry at least one option and non-choice
// questions carry none — prevents orphaned option data. Also enforces that
// allowOther is only set on choice-type questions, for the same reason. Shared
// by the global-question and position-question schemas (client and server) so
// there is one implementation (ENGINEERING §1: abstract at 2+).
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

// Client-side question form schema — reuses validateOptions/validateShortAnswerFormat
// as its single source of truth so RHF surfaces the same rules as field errors,
// rather than re-inlining the choice-type/format constraints. Shared between
// GlobalQuestionDialog and the position QuestionForm (ENGINEERING §1).
export const questionFormSchema = baseQuestionSchema
  .superRefine(validateOptions)
  .superRefine(validateShortAnswerFormat);

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

// Tuple of all ApplicationStatus values EXCEPT 'withdrawn' — shared between zod
// enum (action) and the Select options (control) so both stay in sync with the
// DB enum. 'withdrawn' is intentionally excluded: no consumer today needs the
// full unfiltered status list (mirrors REVIEWER_APPLICATION_STATUSES's doc style).
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

// Statuses a reviewer may not act on — 'draft' (unsubmitted, applicant-owned) and
// 'withdrawn' (applicant-owned lifecycle action). Distinct from
// REVIEWER_APPLICATION_STATUSES above, which is the set a reviewer may set a
// record *to*; this is the set a reviewer may not act *on*. Shared by the single-
// and bulk-update actions so both enforce the same exclusion (ENGINEERING §1).
export const NON_REVIEWABLE_APPLICATION_STATUSES = [
  'draft',
  'withdrawn',
] as const satisfies $Enums.ApplicationStatus[];

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

// Concluded decisions. An accepted/rejected application can no longer be
// withdrawn: there is no status history, so a withdraw → re-open round-trip
// would launder the decision back to 'applied' (#346). Deliberately NOT the
// complement of NON_TERMINAL_APPLICATION_STATUSES, which also excludes
// 'withdrawn'; this set is the decided outcomes only.
export const TERMINAL_DECISION_STATUSES: readonly $Enums.ApplicationStatus[] = [
  'accepted',
  'rejected',
];

// Window (in days) for the "Recently Closed" positions section.
// Positions closed within this window appear in that section.
export const RECENTLY_CLOSED_WINDOW_DAYS = 7;

// Window (in days) for the managed/admin positions visibility filter.
// Closed positions remain visible to managers and admins for longer than the
// public "Recently Closed" section so they retain oversight during wrap-up.
export const MANAGED_POSITIONS_WINDOW_DAYS = 30;

// Tuple of all PositionStatus values — STATUS_OPTIONS derives from this + STATUS_LABELS
// so the label text has a single source of truth.
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

// Client-side position form schema, mirroring createPositionSchema/
// updatePositionSchema's shape. Shared between PositionCreateDialog and
// PositionDetailsForm (ENGINEERING §1).
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

// The rule, stated once (issue #348): `deletedAt` means "does not exist"
// everywhere else in this codebase, so a soft-deleted position's applications
// are dead links and must be hidden on every cross-position surface. `draft`
// positions are unpublished, so applications against one are hidden there too
// — except on position-scoped surfaces (a manager reverting an open position
// to draft still sees its applications on the position card), which use
// VISIBLE_POSITION_WHERE instead.
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

// Shared between the createUser server action and the CreateUserDialog form.
export const createUserSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  name: z.string().trim().optional(),
  isAdmin: z.boolean().default(false),
});

// Maps badge variant to a design-token dot color used in stat cards and the
// activity feed. Extracted from pipeline-summary.tsx so both consumers share
// one source of truth (ENGINEERING §1: abstract at 2+).
export const STATUS_BADGE_VARIANT_TO_DOT: Record<BadgeVariant, string> = {
  info: 'bg-info',
  warning: 'bg-warning',
  success: 'bg-success',
  destructive: 'bg-destructive',
  secondary: 'bg-muted-foreground',
  default: 'bg-primary',
  outline: 'bg-border',
};

// The four application statuses surfaced on position cards for admins/managers.
// Ordered: Applied → Interview scheduled → Accepted → Rejected.
// Shared between PositionStatCluster and any future per-position stat consumer
// so the displayed set is a single source of truth (ENGINEERING §1: abstract at 2+).
export const POSITION_CARD_STAT_STATUSES = [
  'applied',
  'interview_scheduled',
  'accepted',
  'rejected',
] as const satisfies $Enums.ApplicationStatus[];
