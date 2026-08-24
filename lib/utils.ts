import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import type { $Enums } from '@/prisma/client';

import {
  APPLICATION_STATUS_LABELS,
  MANAGED_POSITIONS_WINDOW_DAYS,
  NON_REVIEWABLE_APPLICATION_STATUSES,
  USER_ROLE_FILTER_OPTIONS,
  isNonReviewableApplicationStatus,
} from '@/lib/constants';
import type {
  AnswerPartition,
  AnswerQuestion,
  PositionActivity,
  PositionAvailability,
  PositionWindow,
  UserRoleFilter,
} from '@/lib/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
  return app.applicantName ?? app.user.name ?? app.user.email;
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

/** Alternatives ("reachable from X or Y"), not a conjunction — "or" throughout. */
export function formatAlternatives(labels: string[]): string {
  if (labels.length <= 1) return labels.join('');
  if (labels.length === 2) return labels.join(' or ');
  return `${labels.slice(0, -1).join(', ')}, or ${labels[labels.length - 1]}`;
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

/**
 * Single source of truth for active vs archived — a second implementation is
 * an authorization bug, not just a display bug.
 *
 * Active unless closed (status 'closed', or 'open' past closesAt) AND has no
 * unresolved applications AND is outside the recency window. A lingering
 * 'draft' never counts — it can't be submitted to an already-closed position,
 * so counting it would pin the position active forever.
 */
export function isPositionActive(
  position: PositionActivity,
  now: Date = new Date(),
): boolean {
  const isClosed =
    position.status === 'closed' ||
    getPositionAvailability(position, now) === 'closed_by_date';
  if (!isClosed) return true;
  if (position._count.applications > 0) return true;

  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - MANAGED_POSITIONS_WINDOW_DAYS);
  const recency = position.closesAt ?? position.updatedAt;
  return recency >= cutoff;
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
  eligibleCount: number;
  skippedCount: number;
  /** e.g. "1 withdrawn application"; null when nothing is skipped. */
  skippedLabel: string | null;
};

/** Partitions rows the bulk bar can't touch server-side (NON_REVIEWABLE_APPLICATION_STATUSES). */
export function summarizeBulkStatusChange(
  rows: { status: $Enums.ApplicationStatus }[],
): BulkStatusChangeSummary {
  const skipped = rows.filter((r) =>
    isNonReviewableApplicationStatus(r.status),
  );

  if (skipped.length === 0)
    return { eligibleCount: rows.length, skippedCount: 0, skippedLabel: null };

  const skippedLabel = NON_REVIEWABLE_APPLICATION_STATUSES.map((status) => {
    const count = skipped.filter((r) => r.status === status).length;
    if (count === 0) return null;
    const label = APPLICATION_STATUS_LABELS[status].toLowerCase();
    return `${count} ${label} ${count === 1 ? 'application' : 'applications'}`;
  })
    .filter((part): part is string => part !== null)
    .join(' and ');

  return {
    eligibleCount: rows.length - skipped.length,
    skippedCount: skipped.length,
    skippedLabel,
  };
}
