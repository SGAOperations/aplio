import { redirect } from 'next/navigation';

import {
  getApplications,
  getApplicationsTotal,
  getReviewablePositions,
} from '@/prisma/data/applications';
import { isManager } from '@/prisma/data/managers';

import { getCurrentUser } from '@/lib/auth/server';
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

interface ApplicationsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const VALID_SORT_FIELDS: ApplicationSortField[] = ['date', 'name', 'status'];
const VALID_SORT_DIRECTIONS: ApplicationSortDirection[] = ['asc', 'desc'];

export default async function ApplicationsPage({
  searchParams,
}: ApplicationsPageProps) {
  const user = await getCurrentUser();

  // Authorization guard: admins pass; managers pass only while they have ≥1 position.
  // Regular applicants are redirected to home — the (auth) layout is not sufficient.
  if (!user.isAdmin) {
    const managed = await isManager(user.id);
    if (!managed) redirect('/');
  }

  const sp = await searchParams;

  // Parse filters from searchParams — unknown/invalid values are ignored.
  const rawStatus = typeof sp.status === 'string' ? sp.status : undefined;
  const validStatus: ReviewerStatus | undefined =
    rawStatus &&
    (REVIEWER_APPLICATION_STATUSES as readonly string[]).includes(rawStatus)
      ? (rawStatus as ReviewerStatus)
      : undefined;

  // Parse sort from "field:direction" param (e.g. "date:desc").
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

  const [applications, positions, total] = await Promise.all([
    getApplications(user, filters),
    getReviewablePositions(user),
    getApplicationsTotal(user),
  ]);

  // `total > applications.length` is true only when the take:100 cap actually
  // truncated results — avoids a false positive when exactly 100 apps exist.
  const shownCapped = total > applications.length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
      </header>

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
