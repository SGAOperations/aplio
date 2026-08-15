import type { Metadata } from 'next';

import {
  getApplications,
  getApplicationsTotal,
  getReviewablePositions,
} from '@/prisma/data/applications';

import { requireManagerOrAdminOr404 } from '@/lib/auth/guards';
import { REVIEWER_APPLICATION_STATUSES } from '@/lib/constants';
import type {
  ApplicationFilters,
  ApplicationSort,
  ApplicationSortDirection,
  ApplicationSortField,
  ReviewerStatus,
} from '@/lib/types';

import { ApplicationsTable } from '@/components/features/applications-table';
import { ApplicationsToolbar } from '@/components/features/applications-toolbar';
import { PageHeader } from '@/components/layouts/page-header';

export const metadata: Metadata = { title: 'Applications' };

interface ApplicationsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const VALID_SORT_FIELDS: ApplicationSortField[] = ['date', 'name', 'status'];
const VALID_SORT_DIRECTIONS: ApplicationSortDirection[] = ['asc', 'desc'];

export default async function ApplicationsPage({
  searchParams,
}: ApplicationsPageProps) {
  // The (auth) layout only gates profile completeness, so this gates the role.
  const user = await requireManagerOrAdminOr404();

  const sp = await searchParams;

  const rawStatus = typeof sp.status === 'string' ? sp.status : undefined;
  const validStatus: ReviewerStatus | undefined =
    rawStatus &&
    (REVIEWER_APPLICATION_STATUSES as readonly string[]).includes(rawStatus)
      ? (rawStatus as ReviewerStatus)
      : undefined;

  const rawSort = typeof sp.sort === 'string' ? sp.sort : undefined;
  let validSort: ApplicationSort | undefined;
  if (rawSort) {
    const [rawField, rawDir] = rawSort.split(':');
    const field = rawField as ApplicationSortField;
    const direction = rawDir as ApplicationSortDirection;
    if (
      VALID_SORT_FIELDS.includes(field) &&
      VALID_SORT_DIRECTIONS.includes(direction)
    )
      validSort = { field, direction };
  }

  const filters: ApplicationFilters = {
    positionId: typeof sp.positionId === 'string' ? sp.positionId : undefined,
    status: validStatus,
    userId: typeof sp.userId === 'string' ? sp.userId : undefined,
    q: typeof sp.q === 'string' && sp.q.trim() ? sp.q.trim() : undefined,
    sort: validSort,
  };

  const hasActiveFilters = !!(
    filters.positionId ||
    filters.status ||
    filters.userId ||
    filters.q ||
    filters.sort
  );

  const [fetchedApplications, positions, total] = await Promise.all([
    getApplications(user, filters),
    getReviewablePositions(user),
    getApplicationsTotal(user),
  ]);

  // 101 rows fetched: `> 100` distinguishes truncation from an exact 100-row match.
  const shownCapped = fetchedApplications.length > 100;
  const applications = shownCapped
    ? fetchedApplications.slice(0, 100)
    : fetchedApplications;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Applications"
        description="Review and track submitted applications."
      />

      <ApplicationsToolbar
        positions={positions}
        filters={filters}
        shown={applications.length}
        total={total}
        shownCapped={shownCapped}
        hasActiveFilters={hasActiveFilters}
      />

      <ApplicationsTable
        applications={applications}
        hasActiveFilters={hasActiveFilters}
        sort={filters.sort}
      />
    </div>
  );
}
