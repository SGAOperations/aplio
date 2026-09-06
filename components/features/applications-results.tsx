import 'server-only';

import {
  compareMergedApplicationRows,
  getAllApplications,
  getAllDraftApplications,
  getApplications,
  getApplicationsCount,
  getDraftApplications,
  getDraftApplicationsCount,
} from '@/prisma/data/applications';

import { APPLICATIONS_PAGE_SIZE } from '@/lib/constants';
import { STATE_ICONS } from '@/lib/icons';
import type {
  ApplicationFilters,
  ApplicationTableRow,
  Reviewer,
} from '@/lib/types';

import { ApplicationsPagination } from '@/components/features/applications-pagination';
import { ApplicationsTable } from '@/components/features/applications-table';

interface ApplicationsResultsProps {
  user: Reviewer;
  filters: ApplicationFilters;
  page: number;
  hasActiveFilters: boolean;
  isDraftView?: boolean;
}

// Generic over T so each call site keeps its own row type, not a shared union.
async function fetchPage<T>(
  getCount: (user: Reviewer, filters: ApplicationFilters) => Promise<number>,
  getRows: (
    user: Reviewer,
    filters: ApplicationFilters,
    page: number,
  ) => Promise<T[]>,
  user: Reviewer,
  filters: ApplicationFilters,
  page: number,
) {
  let currentPage = page;
  const [total, initialRows] = await Promise.all([
    getCount(user, filters),
    getRows(user, filters, currentPage),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / APPLICATIONS_PAGE_SIZE));

  let rows = initialRows;

  // Stale/bookmarked ?page= past the last page (e.g. rows removed since) —
  // clamp to the last page instead of rendering a blank table.
  if (total > 0 && rows.length === 0 && currentPage > totalPages) {
    currentPage = totalPages;
    rows = await getRows(user, filters, currentPage);
  }

  return {
    rows,
    total,
    totalPages,
    currentPage,
    rangeStart:
      total === 0 ? 0 : (currentPage - 1) * APPLICATIONS_PAGE_SIZE + 1,
    rangeEnd: Math.min(currentPage * APPLICATIONS_PAGE_SIZE, total),
  };
}

// Slices an already-merged, already-ordered in-memory array — the default
// (no status filter) view has no single query to paginate at the DB level,
// since it unions two purpose-built, differently-scoped queries.
function paginateRows<T>(rows: T[], page: number) {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / APPLICATIONS_PAGE_SIZE));
  const currentPage = total > 0 && page > totalPages ? totalPages : page;
  const start = (currentPage - 1) * APPLICATIONS_PAGE_SIZE;

  return {
    rows: rows.slice(start, start + APPLICATIONS_PAGE_SIZE),
    total,
    totalPages,
    currentPage,
    rangeStart: total === 0 ? 0 : start + 1,
    rangeEnd: Math.min(currentPage * APPLICATIONS_PAGE_SIZE, total),
  };
}

export async function ApplicationsResults({
  user,
  filters,
  page,
  hasActiveFilters,
  isDraftView = false,
}: ApplicationsResultsProps) {
  if (isDraftView) {
    const { rows, total, totalPages, currentPage, rangeStart, rangeEnd } =
      await fetchPage(
        getDraftApplicationsCount,
        getDraftApplications,
        user,
        filters,
        page,
      );

    return (
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground flex items-start gap-2 text-sm">
          <STATE_ICONS.hidden className="mt-0.5 size-4 shrink-0" />
          You can see who started an application, not what they&apos;ve written.
          Draft answers stay private until the applicant submits.
        </p>

        <ApplicationsTable
          isDraftView
          applications={rows}
          hasActiveFilters={hasActiveFilters}
          sort={filters.sort}
        />
        <ApplicationsPagination
          filters={filters}
          currentPage={currentPage}
          totalPages={totalPages}
          total={total}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          hasActiveFilters={hasActiveFilters}
          noun="draft"
        />
      </div>
    );
  }

  // No status filter (the default/"all" view) — merge drafts in with
  // everything else rather than requiring the "Draft" filter to see them.
  // Two purpose-built queries, same as the explicit-filter branches below;
  // only the merge/sort/paginate happens here.
  if (!filters.status) {
    const [allDrafts, allApplications] = await Promise.all([
      getAllDraftApplications(user, filters),
      getAllApplications(user, filters),
    ]);

    // Merge first, then sort the combined set by filters.sort — concatenating
    // two independently-sorted arrays would cluster drafts and applications
    // as two separately-ordered blocks rather than one sorted list.
    const merged: ApplicationTableRow[] = [
      ...allDrafts.map((a) => ({ ...a, isDraft: true as const })),
      ...allApplications.map((a) => ({ ...a, isDraft: false as const })),
    ].sort(compareMergedApplicationRows(filters.sort));

    const { rows, total, totalPages, currentPage, rangeStart, rangeEnd } =
      paginateRows(merged, page);

    return (
      <div className="flex flex-col gap-3">
        <ApplicationsTable
          applications={rows}
          hasActiveFilters={hasActiveFilters}
          sort={filters.sort}
        />
        <ApplicationsPagination
          filters={filters}
          currentPage={currentPage}
          totalPages={totalPages}
          total={total}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          hasActiveFilters={hasActiveFilters}
        />
      </div>
    );
  }

  const { rows, total, totalPages, currentPage, rangeStart, rangeEnd } =
    await fetchPage(getApplicationsCount, getApplications, user, filters, page);

  return (
    <div className="flex flex-col gap-3">
      <ApplicationsTable
        applications={rows.map((a) => ({ ...a, isDraft: false as const }))}
        hasActiveFilters={hasActiveFilters}
        sort={filters.sort}
      />
      <ApplicationsPagination
        filters={filters}
        currentPage={currentPage}
        totalPages={totalPages}
        total={total}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        hasActiveFilters={hasActiveFilters}
      />
    </div>
  );
}
