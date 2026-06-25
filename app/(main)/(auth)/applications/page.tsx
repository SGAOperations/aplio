import { redirect } from 'next/navigation';

import {
  getApplications,
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

  const [applications, positions] = await Promise.all([
    getApplications(user, filters),
    getReviewablePositions(user),
  ]);

  const count = applications.length;
  // `getApplications` caps results at 100; show "100+" when the list may be
  // truncated so the label is never misleadingly exact.
  const countLabel =
    count === 1
      ? '1 application'
      : count >= 100
        ? '100+ applications'
        : count > 0
          ? `${count} applications`
          : null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
        {countLabel && (
          <p className="text-muted-foreground mt-1 text-sm">{countLabel}</p>
        )}
      </header>

      <ApplicationsToolbar positions={positions} filters={filters} />

      <ApplicationsTable
        applications={applications}
        hasActiveFilters={hasActiveFilters}
        sort={filters.sort}
      />
    </div>
  );
}
