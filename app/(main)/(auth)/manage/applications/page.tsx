import type { Metadata } from 'next';
import { Suspense } from 'react';

import {
  getReviewableApplicants,
  getReviewablePositions,
} from '@/prisma/data/applications';

import { requireManagerOrAdminOr404 } from '@/lib/auth/guards';
import { loadApplicationsSearchParams } from '@/lib/search-params';
import type { ApplicationFilters } from '@/lib/types';
import { getApplicationViewMode } from '@/lib/utils';

import {
  ApplicationsResults,
  ApplicationsResultsSkeleton,
  showDraftNote,
} from '@/components/features/applications-results';
import { ApplicationsToolbar } from '@/components/features/applications-toolbar';
import { PageHeader } from '@/components/layouts/page-header';

export const metadata: Metadata = { title: 'Applications' };

interface ApplicationsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ApplicationsPage({
  searchParams,
}: ApplicationsPageProps) {
  // The (auth) layout only gates the name, so this gates the role.
  const user = await requireManagerOrAdminOr404();

  const parsed = await loadApplicationsSearchParams(searchParams);

  const filters: ApplicationFilters = {
    positionIds: parsed.positionIds,
    statuses: parsed.statuses,
    userIds: parsed.userIds,
    q: parsed.q ?? undefined,
    sort: parsed.sort ?? undefined,
  };
  const page = parsed.page;

  const hasActiveFilters = !!(
    filters.positionIds?.length ||
    filters.statuses?.length ||
    filters.userIds?.length ||
    filters.q ||
    filters.sort
  );
  const viewMode = getApplicationViewMode(filters.statuses);
  // Excludes statuses — being in the drafts view isn't itself a filter to clear.
  const hasActiveOtherFilters = !!(
    filters.positionIds?.length ||
    filters.userIds?.length ||
    filters.q ||
    filters.sort
  );

  const [positions, applicants] = await Promise.all([
    getReviewablePositions(user),
    getReviewableApplicants(user),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Applications"
        description="Review and track submitted applications."
      />

      <ApplicationsToolbar
        positions={positions}
        applicants={applicants}
        hasActiveFilters={hasActiveFilters}
      />

      <Suspense
        key={JSON.stringify({ ...filters, page })}
        fallback={
          <ApplicationsResultsSkeleton
            mode={viewMode}
            showDraftNote={showDraftNote(filters)}
          />
        }
      >
        <ApplicationsResults
          user={user}
          filters={filters}
          page={page}
          hasActiveFilters={
            viewMode === 'drafts' ? hasActiveOtherFilters : hasActiveFilters
          }
          mode={viewMode}
        />
      </Suspense>
    </div>
  );
}
