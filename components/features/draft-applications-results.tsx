import 'server-only';

import {
  getDraftApplications,
  getDraftApplicationsCount,
} from '@/prisma/data/applications';

import { APPLICATIONS_PAGE_SIZE } from '@/lib/constants';
import { STATE_ICONS } from '@/lib/icons';
import type { ApplicationFilters, Reviewer } from '@/lib/types';

import { ApplicationsPagination } from '@/components/features/applications-pagination';
import { DraftApplicationsTable } from '@/components/features/draft-applications-table';

interface DraftApplicationsResultsProps {
  user: Reviewer;
  filters: ApplicationFilters;
  page: number;
  hasActiveFilters: boolean;
}

export async function DraftApplicationsResults({
  user,
  filters,
  page,
  hasActiveFilters,
}: DraftApplicationsResultsProps) {
  let currentPage = page;
  const [total, initialDrafts] = await Promise.all([
    getDraftApplicationsCount(user, filters),
    getDraftApplications(user, filters, currentPage),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / APPLICATIONS_PAGE_SIZE));

  let drafts = initialDrafts;

  if (total > 0 && drafts.length === 0 && currentPage > totalPages) {
    currentPage = totalPages;
    drafts = await getDraftApplications(user, filters, currentPage);
  }

  const rangeStart =
    total === 0 ? 0 : (currentPage - 1) * APPLICATIONS_PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * APPLICATIONS_PAGE_SIZE, total);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground flex items-start gap-2 text-sm">
        <STATE_ICONS.hidden className="mt-0.5 size-4 shrink-0" />
        You can see who started an application, not what they&apos;ve written.
        Draft answers stay private until the applicant submits.
      </p>

      <DraftApplicationsTable
        applications={drafts}
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
