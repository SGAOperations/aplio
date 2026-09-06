import 'server-only';

import {
  getApplications,
  getApplicationsCount,
  getDraftApplications,
  getDraftApplicationsCount,
} from '@/prisma/data/applications';

import { APPLICATIONS_PAGE_SIZE } from '@/lib/constants';
import { STATE_ICONS } from '@/lib/icons';
import type { ApplicationFilters, Reviewer } from '@/lib/types';

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

  const { rows, total, totalPages, currentPage, rangeStart, rangeEnd } =
    await fetchPage(getApplicationsCount, getApplications, user, filters, page);

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
