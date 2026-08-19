import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import type { $Enums } from '@/prisma/client';

import {
  APPLICATION_STATUS_LABELS,
  MANAGED_POSITIONS_WINDOW_DAYS,
  NON_REVIEWABLE_APPLICATION_STATUSES,
  isNonReviewableApplicationStatus,
} from '@/lib/constants';
import type {
  AnswerPartition,
  AnswerQuestion,
  PositionActivity,
  PositionAvailability,
  PositionWindow,
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
        fitted: [value[fittedIndex]],
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
  /** Displays the shown count as "100+" when the query capped it. */
  shownCapped?: boolean;
  /** When false, collapses to "{total} {noun}" even if shown and total differ. */
  isFiltered?: boolean;
}

/**
 * Bare count when nothing is hidden, "{shown} / {total}" when the table is truncated.
 */
export function formatTableCount({
  shown,
  total,
  noun,
  pluralNoun,
  shownCapped = false,
  isFiltered = false,
}: FormatTableCountOptions): string {
  const plural = pluralNoun ?? `${noun}s`;
  const nounLabel = total === 1 ? noun : plural;
  const shownLabel = shownCapped ? '100+' : String(shown);

  if (!isFiltered && !shownCapped) return `${total} ${nounLabel}`;
  return `${shownLabel} / ${total} ${nounLabel}`;
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
