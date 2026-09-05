import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import type { $Enums } from '@/prisma/client';

import {
  APPLICATION_STATUS_LABELS,
  DECISION_EMAIL_DELAY_MINUTES,
  DECISION_EMAIL_NOUNS,
  MANAGED_POSITIONS_WINDOW_DAYS,
  USER_ROLE_FILTER_OPTIONS,
  getApplicationStatusRank,
  isNonReviewableApplicationStatus,
} from '@/lib/constants';
import type {
  AnswerPartition,
  AnswerQuestion,
  DecisionEmailNoticeState,
  PositionActivity,
  PositionAvailability,
  PositionDateInfo,
  PositionWindow,
  Reviewer,
  UserRoleFilter,
} from '@/lib/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Trimmed name, or `null` if blank — Better Auth can write `''` on first sign-in. */
export function getUserName(user: { name: string | null }): string | null {
  return user.name?.trim() || null;
}

/** Name if set, else the email — never renders a blank identity. */
export function displayUserName(user: {
  name: string | null;
  email: string;
}): string {
  return getUserName(user) ?? user.email;
}

/** Frozen `applicantName` if set, else the live user's name; `null` if neither. */
export function getApplicantName(app: {
  applicantName: string | null;
  user: { name: string | null };
}): string | null {
  return app.applicantName?.trim() || getUserName(app.user);
}

/** The live name, when it differs from the frozen `applicantName` on the application. */
export function getRenamedTo(app: {
  applicantName: string | null;
  user: { name: string | null };
}): string | null {
  return app.applicantName &&
    app.user.name &&
    app.applicantName !== app.user.name
    ? app.user.name
    : null;
}

/** Applicant's frozen name, falling back to the live user's name then email. */
export function getDisplayName(app: {
  applicantName: string | null;
  user: { name: string | null; email: string };
}): string {
  return getApplicantName(app) ?? app.user.email;
}

/** "<From> → <To>", or "Status recorded as <To>" for the null-`from` backfill row. */
export function getApplicationStatusHistoryRowLabel(entry: {
  from: $Enums.ApplicationStatus | null;
  to: $Enums.ApplicationStatus;
}): string {
  if (entry.from === null)
    return `Status recorded as ${APPLICATION_STATUS_LABELS[entry.to]}`;
  return `${APPLICATION_STATUS_LABELS[entry.from]} → ${APPLICATION_STATUS_LABELS[entry.to]}`;
}

export type ErrorType = { error: string };

export type ResponseType<T> = T | ErrorType;

export function isError<T>(result: ResponseType<T>): result is ErrorType {
  return (
    result !== null &&
    result !== undefined &&
    typeof result === 'object' &&
    'error' in result
  );
}

/**
 * Re-thrown from a server action's `{ error }` result; its message is user-facing.
 */
export class ActionError extends Error {}

/**
 * Default-DENY: an unset VERCEL_ENV also describes production off Vercel.
 * Single gate for issuing and accepting the bypass cookie; preview stays allowed by design.
 */
export function isBypassAllowed(): boolean {
  return (
    process.env.VERCEL_ENV === 'development' ||
    process.env.VERCEL_ENV === 'preview'
  );
}

export function toStringArray(v: unknown): string[] {
  if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return v;
  return [];
}

/** True when `a` and `b` contain exactly the same ids, no duplicates in either. */
export function isSameIdSet(
  a: readonly string[],
  b: readonly string[],
): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size !== a.length || setB.size !== b.length) return false;
  for (const id of setA) if (!setB.has(id)) return false;
  return true;
}

/** Joins truthy ids for `aria-describedby`; `undefined` when none apply. */
export function composeDescribedBy(
  ...ids: Array<string | false | null | undefined>
): string | undefined {
  return ids.filter((v): v is string => Boolean(v)).join(' ') || undefined;
}

/** Splits a stored answer into what still fits the question's shape (`fitted`) vs. what doesn't (`orphaned`); together always `value`. */
export function partitionAnswerValue(
  question: AnswerQuestion,
  value: string[],
): AnswerPartition {
  switch (question.type) {
    case 'short_answer':
    case 'long_answer':
    case 'file_upload':
      return { fitted: value.slice(0, 1), orphaned: value.slice(1) };

    case 'single_choice': {
      // entry 0 renders either as an option or as the "Other" text.
      if (question.allowOther)
        return { fitted: value.slice(0, 1), orphaned: value.slice(1) };

      const fittedIndex = value.findIndex((v) => question.options.includes(v));
      if (fittedIndex === -1) return { fitted: [], orphaned: value };
      return {
        fitted: [value[fittedIndex] as string],
        orphaned: [
          ...value.slice(0, fittedIndex),
          ...value.slice(fittedIndex + 1),
        ],
      };
    }

    case 'multiple_choice': {
      const inOptions = value.filter((v) => question.options.includes(v));
      const notInOptions = value.filter((v) => !question.options.includes(v));
      if (!question.allowOther)
        return { fitted: inOptions, orphaned: notInOptions };

      // Checked options plus first non-option entry ("Other" text); rest orphaned.
      const [otherValue, ...restOrphaned] = notInOptions;
      return {
        fitted:
          otherValue !== undefined ? [...inOptions, otherValue] : inOptions,
        orphaned: restOrphaned,
      };
    }

    default: {
      // Unreachable — a new type breaks the build via `never`, not silently at runtime.
      const exhaustiveCheck: never = question.type;
      return exhaustiveCheck;
    }
  }
}

/** True when the stored answer has any part that still fits the question's current shape. */
export function isAnswered(question: AnswerQuestion, value: string[]): boolean {
  return partitionAnswerValue(question, value).fitted.length > 0;
}

/** An application row wins even when empty (a deliberate clear); no row falls back to the profile. */
export function resolveGlobalAnswerValues(
  questionIds: string[],
  applicationAnswers: { globalQuestionId: string; value: string[] }[],
  profileAnswers: { globalQuestionId: string; value: string[] }[],
): Map<string, string[]> {
  const appValues = new Map(
    applicationAnswers.map((a) => [a.globalQuestionId, a.value]),
  );
  const profileValues = new Map(
    profileAnswers.map((a) => [a.globalQuestionId, a.value]),
  );
  return new Map(
    questionIds.map((id) => [
      id,
      appValues.get(id) ?? profileValues.get(id) ?? [],
    ]),
  );
}

/** Questions whose current value differs from the profile value a revert would write; order- and whitespace-sensitive, matching what the server actually stores. */
export function findDivergingGlobalAnswers(
  questionIds: string[],
  currentValues: Map<string, string[]>,
  profileAnswers: { globalQuestionId: string; value: string[] }[],
): { questionId: string; profileValue: string[] }[] {
  const profileValues = new Map(
    profileAnswers.map((a) => [a.globalQuestionId, a.value]),
  );
  return questionIds
    .map((questionId) => {
      const current = currentValues.get(questionId) ?? [];
      const profileValue = profileValues.get(questionId) ?? [];
      return { questionId, profileValue, current };
    })
    .filter(
      ({ current, profileValue }) =>
        current.length !== profileValue.length ||
        !current.every((v, i) => v === profileValue[i]),
    )
    .map(({ questionId, profileValue }) => ({ questionId, profileValue }));
}

/** Ids shared by every answer surface, so a card's label/input/error/notice/status stay wired to each other. */
export function answerFieldIds(questionId: string) {
  return {
    labelId: `${questionId}-label`,
    inputId: `${questionId}-input`,
    errorId: `${questionId}-error`,
    noticeId: `${questionId}-mismatch`,
    statusId: `${questionId}-status`,
  };
}

/** Splits a fitted answer into its checked options and its free-text "Other" entry, if any. */
export function splitOtherAnswer(
  question: { options: string[] },
  fitted: string[],
): { selectedOptions: string[]; otherText: string } {
  return {
    selectedOptions: fitted.filter((v) => question.options.includes(v)),
    otherText: fitted.find((v) => !question.options.includes(v)) ?? '',
  };
}

/**
 * Strips markdown syntax to plain text for metadata and emptiness checks.
 * Never used to render a description — use `<Markdown>` for that.
 */
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^(.+)\n(=+|-+)$/gm, '$1')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*([-*_]\s*){3,}$/gm, ' ')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/\|/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getPositionAvailability(
  position: PositionWindow,
  now: Date = new Date(),
): PositionAvailability {
  if (position.status !== 'open') return 'unavailable';

  if (position.opensAt !== null && now < position.opensAt) return 'upcoming';
  if (position.closesAt !== null && now > position.closesAt)
    return 'closed_by_date';

  return 'accepting';
}

export function isAcceptingApplications(
  position: PositionWindow,
  now?: Date,
): boolean {
  return getPositionAvailability(position, now) === 'accepting';
}

// 'closed_by_date' is reachable only from status 'open' — that divergence is the whole condition.
export function isOpenPastCloseDate(
  position: PositionWindow,
  now?: Date,
): boolean {
  return getPositionAvailability(position, now) === 'closed_by_date';
}

export function getPositionDateInfo(
  position: PositionWindow,
  now: Date = new Date(),
): PositionDateInfo | null {
  if (position.status === 'draft') {
    // A stale date outranks a future one — the missed date is the thing needing attention.
    if (position.closesAt && now > position.closesAt)
      return {
        label: 'Was scheduled to close',
        date: position.closesAt,
        emphasis: 'stale',
      };
    if (position.opensAt && now > position.opensAt)
      return {
        label: 'Was scheduled to open',
        date: position.opensAt,
        emphasis: 'stale',
      };
    if (position.closesAt)
      return { label: 'Closes', date: position.closesAt, emphasis: 'calm' };
    if (position.opensAt)
      return { label: 'Opens', date: position.opensAt, emphasis: 'calm' };
    return null;
  }

  // Past the draft branch, 'unavailable' can only mean status 'closed'.
  const availability = getPositionAvailability(position, now);
  if (availability === 'accepting' && position.closesAt)
    return { label: 'Closes', date: position.closesAt, emphasis: 'live' };
  if (availability === 'upcoming' && position.opensAt)
    return { label: 'Opens', date: position.opensAt, emphasis: 'live' };
  if (
    (availability === 'closed_by_date' || availability === 'unavailable') &&
    position.closesAt
  )
    return { label: 'Closed', date: position.closesAt, emphasis: 'calm' };

  return null;
}

/**
 * Single source of truth for active vs archived — a second implementation is
 * an authorization bug, not just a display bug.
 *
 * Active unless closed (status 'closed', or 'open' past closesAt) AND it's
 * been closed for at least MANAGED_POSITIONS_WINDOW_DAYS AND no application
 * status has changed in that same window — an unresolved application only
 * keeps a position active while it's still being worked.
 */
export function isPositionActive(
  position: PositionActivity,
  now: Date = new Date(),
): boolean {
  const isClosed =
    position.status === 'closed' ||
    getPositionAvailability(position, now) === 'closed_by_date';
  if (!isClosed) return true;

  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - MANAGED_POSITIONS_WINDOW_DAYS);

  const closedSince = position.closesAt ?? position.updatedAt;
  if (closedSince >= cutoff) return true;

  return (
    position.lastStatusChangeAt !== null &&
    position.lastStatusChangeAt >= cutoff
  );
}

// Pure mirror of checkPositionAccess for rows already fetched. Compares ids
// (rather than trusting a pre-filtered list) so it's correct against a full manager list too.
export function canReviewPosition(
  user: Reviewer,
  managerIds: string[],
): boolean {
  return user.isAdmin || managerIds.includes(user.id);
}

interface FormatTableCountOptions {
  shown: number;
  total: number;
  /** Singular noun; pluralized by appending "s" unless `pluralNoun` is given. */
  noun: string;
  pluralNoun?: string;
  /** When false, collapses to "{total} {noun}" even if shown and total differ. */
  isFiltered?: boolean;
}

/**
 * Bare count when nothing is hidden, "{shown} / {total}" when filtered.
 */
export function formatTableCount({
  shown,
  total,
  noun,
  pluralNoun,
  isFiltered = false,
}: FormatTableCountOptions): string {
  const plural = pluralNoun ?? `${noun}s`;
  const nounLabel = total === 1 ? noun : plural;

  if (!isFiltered) return `${total} ${nounLabel}`;
  return `${shown} / ${total} ${nounLabel}`;
}

/**
 * Page-number window for pagination nav: always first + last, current ±1,
 * `'ellipsis'` for gaps. Caps at 7 slots.
 */
export function getPaginationRange(
  currentPage: number,
  totalPages: number,
): (number | 'ellipsis')[] {
  if (totalPages <= 7)
    return Array.from({ length: totalPages }, (_, i) => i + 1);

  const pages = new Set<number>([
    1,
    totalPages,
    currentPage,
    currentPage - 1,
    currentPage + 1,
  ]);
  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  const result: (number | 'ellipsis')[] = [];
  sorted.forEach((page, i) => {
    if (i > 0) {
      const prev = sorted[i - 1] as number;
      if (page - prev === 2) result.push(prev + 1);
      else if (page - prev > 2) result.push('ellipsis');
    }
    result.push(page);
  });

  return result;
}

interface FormatPaginationSummaryOptions {
  rangeStart: number;
  rangeEnd: number;
  total: number;
  noun: string;
  pluralNoun?: string;
  isFiltered?: boolean;
}

/**
 * "Showing {start}–{end} of {total} [matching] {noun}" for multi-page results;
 * a bare count when everything fits on one page.
 */
export function formatPaginationSummary({
  rangeStart,
  rangeEnd,
  total,
  noun,
  pluralNoun,
  isFiltered = false,
}: FormatPaginationSummaryOptions): string {
  const plural = pluralNoun ?? `${noun}s`;
  const nounLabel = total === 1 ? noun : plural;
  const matching = isFiltered ? 'matching ' : '';

  if (rangeStart === 1 && rangeEnd === total)
    return `${total} ${matching}${nounLabel}`;
  return `Showing ${rangeStart}–${rangeEnd} of ${total} ${matching}${nounLabel}`;
}

/** `m:ss`, always minutes-and-seconds (never a bare second count); negative clamps to `0:00`. */
export function formatCountdown(seconds: number): string {
  const clamped = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(clamped / 60);
  const rest = clamped % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

interface RoleTokenInput {
  isAdmin: boolean;
  managedPositions: readonly unknown[];
}

/** Badge semantics — a user who is both admin and manager returns both tokens. */
export function getUserRoleTokens(user: RoleTokenInput): UserRoleFilter[] {
  const tokens: UserRoleFilter[] = [];
  if (user.isAdmin) tokens.push('admin');
  if (user.managedPositions.length > 0) tokens.push('manager');
  return tokens;
}

/** Rank for grouping/sorting — the first (highest) role token, or last when the user has none. */
export function getUserRoleRank(user: RoleTokenInput): number {
  const [first] = getUserRoleTokens(user);
  if (!first) return USER_ROLE_FILTER_OPTIONS.length;
  return USER_ROLE_FILTER_OPTIONS.findIndex((o) => o.value === first);
}

export type BulkStatusChangeSummary = {
  forwardCount: number;
  backwardCount: number;
  finalDecisionCount: number;
  skippedCount: number;
  eligibleCount: number;
  /** e.g. "1 skipped — drafts, withdrawn, or already Reviewing."; null when nothing is skipped. */
  skippedLabel: string | null;
  // True when the target is a decision, or the batch reverses one — either
  // way an applicant sees something other than the "Applied" collapse.
  applicantVisible: boolean;
};

/**
 * Four-way split of a bulk move toward `target`: skipped (draft, withdrawn,
 * or already at target) → final decision (currently accepted/rejected) →
 * backward (further along the path than target) → forward. Mutually
 * exclusive, evaluated in that order.
 */
export function summarizeBulkStatusChange(
  rows: { status: $Enums.ApplicationStatus }[],
  target: $Enums.ApplicationStatus,
): BulkStatusChangeSummary {
  let forwardCount = 0;
  let backwardCount = 0;
  let finalDecisionCount = 0;
  let skippedCount = 0;

  const targetRank = getApplicationStatusRank(target);

  for (const row of rows) {
    if (isNonReviewableApplicationStatus(row.status) || row.status === target) {
      skippedCount++;
      continue;
    }
    if (row.status === 'accepted' || row.status === 'rejected') {
      finalDecisionCount++;
      continue;
    }
    const rowRank = getApplicationStatusRank(row.status);
    if (rowRank !== null && targetRank !== null && rowRank > targetRank)
      backwardCount++;
    else forwardCount++;
  }

  return {
    forwardCount,
    backwardCount,
    finalDecisionCount,
    skippedCount,
    eligibleCount: rows.length - skippedCount,
    skippedLabel:
      skippedCount > 0
        ? `${skippedCount} skipped — drafts, withdrawn, or already ${APPLICATION_STATUS_LABELS[target]}.`
        : null,
    applicantVisible:
      target === 'accepted' || target === 'rejected' || finalDecisionCount > 0,
  };
}

/** First word of a name, or undefined for empty/missing — greeting fallback lives at the call site. */
export function getFirstName(name?: string | null): string | undefined {
  const trimmed = name?.trim();
  return trimmed ? trimmed.split(/\s+/)[0] : undefined;
}

/** Shared by the single-decision confirm dialog and the override dialog's inline warning. */
export function getDecisionEmailWarning(name?: string): string {
  const subject = name ?? 'The applicant';
  return `${subject} will be emailed in ${DECISION_EMAIL_DELAY_MINUTES} minutes. Undo before then and nothing is sent.`;
}

export type BulkImmediateEmailWarning = {
  count: number;
  lead: string;
  detail: string;
};

/** Bulk decisions have no window — always immediate, whatever the count. */
export function getBulkImmediateEmailWarning(
  count: number,
): BulkImmediateEmailWarning {
  const isSingular = count === 1;
  const lead = isSingular
    ? 'This email sends immediately.'
    : `These ${count} emails send immediately.`;
  const told = isSingular ? 'the applicant has' : 'the applicants have';
  const detail = `There is no 15-minute delay and no undo — once you confirm, ${told} been told. Accepting or rejecting one at a time waits 15 minutes; this does not.`;
  return { count, lead, detail };
}

/** Statuses meaning Resend has dispatched the email — the single bucket
 * getDecisionEmailNotice and the one-email-ever gate both classify against. */
export function classifyDecisionEmailStatus(
  status: $Enums.EmailStatus,
): 'scheduled' | 'sent' | null {
  switch (status) {
    case 'scheduled':
      return 'scheduled';
    case 'sent':
    case 'delivered':
    case 'bounced':
    case 'complained':
    case 'suppressed':
      return 'sent';
    case 'cancelled':
    case 'failed':
      return null;
    default: {
      const exhaustive: never = status;
      throw new Error(`Unhandled email status: ${JSON.stringify(exhaustive)}`);
    }
  }
}

export interface UndoDecisionEmailNotice {
  lead: string;
  /** Only set while still cancellable — renders as a real <LocalTime>, not relative-to-open-time text. */
  scheduledAt?: Date;
}

/** Undo copy distinguishing a cancellable send from an expired window or one already sent; null renders nothing. */
export function getUndoDecisionEmailNotice(
  state: DecisionEmailNoticeState,
  status: 'accepted' | 'rejected',
  windowExpired: boolean,
): UndoDecisionEmailNotice | null {
  if (state === null) return null;
  const noun = DECISION_EMAIL_NOUNS[status];
  if (state.status === 'sent')
    return { lead: `The ${noun} email has already been sent.` };
  if (windowExpired)
    return {
      lead: `The ${noun} email's undo window has passed — it may have already sent.`,
    };
  return {
    lead: `The ${noun} email is scheduled to send at`,
    scheduledAt: state.scheduledAt,
  };
}

/** Same predicate updateApplicationStatuses uses — right even when it differs from the bulk bar's coarser eligibleCount. */
export function countBulkEmailRecipients(
  rows: { status: $Enums.ApplicationStatus }[],
  target: $Enums.ApplicationStatus,
): number {
  return rows.filter(
    (r) => !isNonReviewableApplicationStatus(r.status) && r.status !== target,
  ).length;
}
