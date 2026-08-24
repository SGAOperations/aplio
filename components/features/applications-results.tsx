import 'server-only';

import {
  getApplications,
  getApplicationsCount,
} from '@/prisma/data/applications';

import { APPLICATIONS_PAGE_SIZE } from '@/lib/constants';
import type { ApplicationFilters, Reviewer } from '@/lib/types';

import { ApplicationsPagination } from '@/components/features/applications-pagination';
import { ApplicationsTable } from '@/components/features/applications-table';

interface ApplicationsResultsProps {
  user: Reviewer;
  filters: ApplicationFilters;
  page: number;
  hasActiveFilters: boolean;
}

export async function ApplicationsResults({
  user,
  filters,
  page,
  hasActiveFilters,
}: ApplicationsResultsProps) {
  let currentPage = page;
  const [total, initialApplications] = await Promise.all([
    getApplicationsCount(user, filters),
    getApplications(user, filters, currentPage),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / APPLICATIONS_PAGE_SIZE));

  let applications = initialApplications;

  // Stale/bookmarked ?page= past the last page (e.g. rows removed since) —
  // clamp to the last page instead of rendering a blank table.
  if (total > 0 && applications.length === 0 && currentPage > totalPages) {
    currentPage = totalPages;
    applications = await getApplications(user, filters, currentPage);
  }

  const rangeStart =
    total === 0 ? 0 : (currentPage - 1) * APPLICATIONS_PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * APPLICATIONS_PAGE_SIZE, total);

  return (
    <div className="flex flex-col gap-3">
      <ApplicationsTable
        applications={applications}
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
      />
    </div>
  );
}
