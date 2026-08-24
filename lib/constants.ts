import { z } from 'zod/v4';

import { $Enums } from '@/prisma/client';
import type { PositionStatus, Prisma, QuestionType } from '@/prisma/client';

import type { PositionAvailability, UserRoleFilter } from '@/lib/types';

import type { BadgeVariant } from '@/components/ui/badge';

// Authoring zone for position windows — see lib/dates.ts.
export const ORG_TIMEZONE = 'America/New_York';

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

// Shared between client-side inline checks and server actions so messages can't drift.
export const ANSWER_SHORT_MAX_LENGTH = 500;
export const ANSWER_LONG_MAX_LENGTH = 5000;
export const ANSWER_OTHER_MAX_LENGTH = 200;
export const QUESTION_OPTION_MAX_LENGTH = 200;
export const QUESTION_MAX_OPTIONS = 50;
// +1 for the free-text "Other" entry alongside a full set of options.
export const ANSWER_MAX_VALUES = QUESTION_MAX_OPTIONS + 1;

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

export const FORMAT_INPUT_TYPES: Record<ShortAnswerFormatValue, string> = {
  email: 'email',
  phone_number: 'tel',
  url: 'url',
  zip_code: 'text',
};

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
  // Caps option count/length so no answer-side limit becomes unselectable.
  if (data.options.length > QUESTION_MAX_OPTIONS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['options'],
      message: `Remove some options — ${QUESTION_MAX_OPTIONS} is the maximum.`,
    });
  }
  if (data.options.some((o) => o.length > QUESTION_OPTION_MAX_LENGTH)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['options'],
      message: `Each option must be ${QUESTION_OPTION_MAX_LENGTH} characters or fewer.`,
    });
  }
}

// Write-path only — an already-stored value that no longer fits still displays unchanged.
export function getAnswerValueError(
  question: { type: QuestionType; options: string[]; allowOther: boolean },
  value: string[],
): string | null {
  if (value.length === 0) return null;

  switch (question.type) {
    case 'short_answer':
      if (value.length > 1)
        return 'Only one answer is allowed for this question.';
      if ((value[0] ?? '').length > ANSWER_SHORT_MAX_LENGTH)
        return `Answer must be ${ANSWER_SHORT_MAX_LENGTH} characters or fewer.`;
      return null;

    case 'long_answer':
      if (value.length > 1)
        return 'Only one answer is allowed for this question.';
      if ((value[0] ?? '').length > ANSWER_LONG_MAX_LENGTH)
        return `Answer must be ${ANSWER_LONG_MAX_LENGTH} characters or fewer.`;
      return null;

    case 'single_choice': {
      if (value.length > 1)
        return 'Only one answer is allowed for this question.';
      const entry = value[0] ?? '';
      if (question.options.includes(entry)) return null;
      // Not a current option — no free text allowed, or this is the "Other" entry.
      if (!question.allowOther)
        return 'That choice is no longer available. Refresh the page and answer again.';
      if (entry.length > ANSWER_OTHER_MAX_LENGTH)
        return `Answer must be ${ANSWER_OTHER_MAX_LENGTH} characters or fewer.`;
      return null;
    }

    case 'multiple_choice': {
      // Checked first — catches a duplicate "Other" entry the membership check below can't see.
      if (new Set(value).size !== value.length)
        return 'That answer is already one of the choices — select it from the list instead.';

      const nonOptionEntries = value.filter(
        (v) => !question.options.includes(v),
      );
      if (!question.allowOther)
        return nonOptionEntries.length > 0
          ? 'That choice is no longer available. Refresh the page and answer again.'
          : null;
      if (nonOptionEntries.length > 1)
        return 'Only one "Other" answer is allowed.';
      if (
        nonOptionEntries.length === 1 &&
        (nonOptionEntries[0] ?? '').length > ANSWER_OTHER_MAX_LENGTH
      )
        return `Answer must be ${ANSWER_OTHER_MAX_LENGTH} characters or fewer.`;
      return null;
    }

    // file_upload values are blob URLs owned by prisma/actions/question-files.ts.
    case 'file_upload':
      return null;

    default: {
      const exhaustiveCheck: never = question.type;
      throw new Error(`Unhandled question type: ${exhaustiveCheck}`);
    }
  }
}

// Blur-time check: format on the raw first entry, then the shared value rules.
export function getAnswerBlurError(
  question: {
    type: QuestionType;
    options: string[];
    allowOther: boolean;
    format: ShortAnswerFormatValue | null;
  },
  value: string[],
): string | null {
  if (
    question.type === 'short_answer' &&
    question.format &&
    value[0] &&
    !matchesShortAnswerFormat(value[0], question.format)
  )
    return SHORT_ANSWER_FORMAT_ERROR_MESSAGES[question.format];

  return getAnswerValueError(question, value);
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

// Array order is rank order — also drives getUserRoleRank's fallback.
export const USER_ROLE_FILTER_OPTIONS: {
  value: UserRoleFilter;
  label: string;
}[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
];

// Single source for the /applications sort union and its zod enum.
export const APPLICATION_SORT_FIELDS = ['date', 'name', 'status'] as const;
export const APPLICATION_SORT_DIRECTIONS = ['asc', 'desc'] as const;

// Single source of truth for the server guard and the rendered quick actions.
// Array order is display order; `draft`/`withdrawn` have no reviewer moves.
export const APPLICATION_STATUS_TRANSITIONS = {
  draft: { forward: [], back: [] },
  applied: { forward: ['reached_out', 'reviewing'], back: [] },
  reached_out: {
    forward: ['interview_scheduled', 'reviewing'],
    back: ['applied'],
  },
  interview_scheduled: {
    forward: ['reviewing', 'accepted'],
    back: ['reached_out'],
  },
  reviewing: {
    forward: ['interview_scheduled', 'accepted'],
    back: ['reached_out'],
  },
  accepted: { forward: [], back: ['reviewing', 'interview_scheduled'] },
  rejected: { forward: [], back: ['reviewing', 'interview_scheduled'] },
  withdrawn: { forward: [], back: [] },
} as const satisfies Record<
  $Enums.ApplicationStatus,
  {
    forward: readonly $Enums.ApplicationStatus[];
    back: readonly $Enums.ApplicationStatus[];
  }
>;

// Same members as UNRESOLVED_APPLICATION_STATUSES, but a different meaning —
// 'rejected' is reachable from every one of these.
export const REJECTABLE_APPLICATION_STATUSES = [
  'applied',
  'reached_out',
  'interview_scheduled',
  'reviewing',
] as const satisfies $Enums.ApplicationStatus[];

export function getAllowedApplicationStatusTransitions(
  from: $Enums.ApplicationStatus,
): $Enums.ApplicationStatus[] {
  const { forward, back } = APPLICATION_STATUS_TRANSITIONS[from];
  const isRejectable = (
    REJECTABLE_APPLICATION_STATUSES as readonly $Enums.ApplicationStatus[]
  ).includes(from);
  return [
    ...forward,
    ...(isRejectable ? (['rejected'] as const) : []),
    ...back,
  ];
}

export function isAllowedApplicationStatusTransition(
  from: $Enums.ApplicationStatus,
  to: $Enums.ApplicationStatus,
): boolean {
  return getAllowedApplicationStatusTransitions(from).includes(to);
}

// Inverts the graph rather than hand-listing sources, so the two can't drift.
export function getApplicationStatusSources(
  to: $Enums.ApplicationStatus,
): $Enums.ApplicationStatus[] {
  return (
    Object.keys(APPLICATION_STATUS_TRANSITIONS) as $Enums.ApplicationStatus[]
  ).filter((from) => isAllowedApplicationStatusTransition(from, to));
}

// Bulk targets exclude move-back sources: a batch moving several applications
// toward a target should skip a row already past it, not walk it backward.
// A target with no forward source at all (e.g. 'applied') is back-only, so
// there's no "already past it" row to protect — fall back to its back
// sources rather than making that target permanently unreachable in bulk.
export function getApplicationStatusForwardSources(
  to: $Enums.ApplicationStatus,
): $Enums.ApplicationStatus[] {
  const forwardSources = (
    Object.keys(APPLICATION_STATUS_TRANSITIONS) as $Enums.ApplicationStatus[]
  ).filter((from) => {
    const { forward } = APPLICATION_STATUS_TRANSITIONS[from];
    const isRejectable = (
      REJECTABLE_APPLICATION_STATUSES as readonly $Enums.ApplicationStatus[]
    ).includes(from);
    return (
      (forward as readonly $Enums.ApplicationStatus[]).includes(to) ||
      (isRejectable && to === 'rejected')
    );
  });
  if (forwardSources.length > 0) return forwardSources;

  return (
    Object.keys(APPLICATION_STATUS_TRANSITIONS) as $Enums.ApplicationStatus[]
  ).filter((from) =>
    (
      APPLICATION_STATUS_TRANSITIONS[from]
        .back as readonly $Enums.ApplicationStatus[]
    ).includes(to),
  );
}

// Imperative copy for forward/decision quick-action buttons. 'applied' is a
// back-target only — a reviewer never moves an application forward into it.
export const APPLICATION_STATUS_ACTION_LABELS: Record<
  (typeof REVIEWER_APPLICATION_STATUSES)[number],
  string
> = {
  applied: 'Move to applied',
  reached_out: 'Mark reached out',
  reviewing: 'Move to reviewing',
  interview_scheduled: 'Interview scheduled',
  accepted: 'Accept',
  rejected: 'Reject',
};

export const TERMINAL_DECISION_STATUS_NOTES: Record<
  'accepted' | 'rejected',
  string
> = {
  accepted: 'Accepted. The applicant can no longer withdraw this application.',
  rejected: 'Rejected. The applicant can no longer withdraw this application.',
};

// States a reviewer may not act *on*, unlike REVIEWER_APPLICATION_STATUSES (may set *to*).
export const NON_REVIEWABLE_APPLICATION_STATUSES = [
  'draft',
  'withdrawn',
] as const satisfies $Enums.ApplicationStatus[];

// Narrows a status without an unsafe cast at each call site.
export function isNonReviewableApplicationStatus(
  status: $Enums.ApplicationStatus,
): status is (typeof NON_REVIEWABLE_APPLICATION_STATUSES)[number] {
  return (
    NON_REVIEWABLE_APPLICATION_STATUSES as readonly $Enums.ApplicationStatus[]
  ).includes(status);
}

export const NON_REVIEWABLE_APPLICATION_STATUS_NOTES: Record<
  (typeof NON_REVIEWABLE_APPLICATION_STATUSES)[number],
  string
> = {
  withdrawn:
    'This application was withdrawn by the applicant and can no longer be updated.',
  draft: 'This application has not been submitted yet.',
};

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

// No status history, so a withdraw → resubmit round-trip would launder the decision.
export const TERMINAL_DECISION_STATUSES: readonly $Enums.ApplicationStatus[] = [
  'accepted',
  'rejected',
];

export const RECENTLY_CLOSED_WINDOW_DAYS = 7;

// Longer than the public window so managers and admins keep oversight during wrap-up.
export const MANAGED_POSITIONS_WINDOW_DAYS = 30;

// Returned by updatePosition / the three position-question actions when isPositionActive is false.
export const ARCHIVED_POSITION_EDIT_ERROR =
  'This position is archived. Ask an admin if it still needs changes.';

// Shared by positionFormSchema and createPositionSchema/updatePositionSchema.
export const POSITION_OPENS_AT_ORDER_ERROR =
  'The open date must be on or before the close date.';
export const POSITION_CLOSES_AT_ORDER_ERROR =
  'The close date must be on or after the open date.';

// YYYY-MM-DD strings sort lexically the same as calendar order, so a plain
// comparison is exact without parsing into org-day boundaries.
export function validatePositionDates(
  data: { opensAt?: string; closesAt?: string },
  ctx: z.RefinementCtx,
) {
  if (!data.opensAt || !data.closesAt) return;
  if (data.opensAt > data.closesAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['opensAt'],
      message: POSITION_OPENS_AT_ORDER_ERROR,
    });
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['closesAt'],
      message: POSITION_CLOSES_AT_ORDER_ERROR,
    });
  }
}

// Returned by deletePosition when it has non-draft applications.
export const POSITION_DELETE_BLOCKED_ERROR =
  "This position has applications, so it can't be deleted. Close it instead.";

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

export const POSITION_DESCRIPTION_MAX_LENGTH = 10000;
export const MARKDOWN_GUIDE_URL = 'https://www.markdownguide.org/basic-syntax/';

// Mirrors createPositionSchema/updatePositionSchema — keep the shapes in sync.
const orgDayInputSchema = z.union([z.iso.date(), z.literal('')], {
  error: 'Enter a valid date',
});

export const positionFormSchema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    description: z
      .string()
      .max(
        POSITION_DESCRIPTION_MAX_LENGTH,
        `Description must be ${POSITION_DESCRIPTION_MAX_LENGTH.toLocaleString()} characters or fewer.`,
      ),
    status: z.enum(STATUS_VALUES),
    opensAt: orgDayInputSchema.optional(),
    closesAt: orgDayInputSchema.optional(),
  })
  .superRefine(validatePositionDates);

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
  // Lowercased to match Better Auth, which lowercases before its
  // case-sensitive lookup on sign-in. A mixed-case invite would miss that
  // lookup and — the unique index being case-sensitive too — succeed as a
  // second, non-admin row instead of resolving the invited one.
  email: z
    .string()
    .trim()
    .email('Enter a valid email address.')
    .transform((value) => value.toLowerCase()),
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

// Shared with lib/auth/config.ts's session-create hook so the client can
// branch on this specific refusal instead of a generic OTP failure.
export const ACCOUNT_DEACTIVATED_ERROR_CODE = 'ACCOUNT_DEACTIVATED';

// Shared between checkSignInAllowed and LoginView's OTP failure so the copy can't drift between surfaces.
export const ACCOUNT_DEACTIVATED_MESSAGE =
  'Your account has been deactivated. Please contact an administrator.';

// Shared between the checkSignInAllowed server action and LoginView's email step resolver.
export const signInEmailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

// Shared between LoginView's client-side countdown and isOtpResendAllowed's
// server-side check so they can't drift.
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

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
