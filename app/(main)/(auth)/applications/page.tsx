import type { Metadata } from 'next';
import { Suspense } from 'react';

import { z } from 'zod/v4';

import { getReviewablePositions } from '@/prisma/data/applications';

import { requireManagerOrAdminOr404 } from '@/lib/auth/guards';
import {
  APPLICATION_SORT_DIRECTIONS,
  APPLICATION_SORT_FIELDS,
  REVIEWER_APPLICATION_STATUSES,
} from '@/lib/constants';
import type { ApplicationFilters } from '@/lib/types';

import { ApplicationsResults } from '@/components/features/applications-results';
import { ApplicationsTableSkeleton } from '@/components/features/applications-table-skeleton';
import { ApplicationsToolbar } from '@/components/features/applications-toolbar';
import { PageHeader } from '@/components/layouts/page-header';

export const metadata: Metadata = { title: 'Applications' };

interface ApplicationsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// A single-value param is a string; a repeated one arrives as string[] — reject both
// with .catch(undefined) rather than throwing, so one bad param never sinks the rest.
const searchParamsSchema = z.object({
  positionId: z.string().trim().min(1).max(64).optional().catch(undefined),
  userId: z.string().trim().min(1).max(64).optional().catch(undefined),
  status: z.enum(REVIEWER_APPLICATION_STATUSES).optional().catch(undefined),
  q: z.string().trim().min(1).max(200).optional().catch(undefined),
  sort: z
    .string()
    .transform((value) => value.split(':'))
    .pipe(
      z.tuple([
        z.enum(APPLICATION_SORT_FIELDS),
        z.enum(APPLICATION_SORT_DIRECTIONS),
      ]),
    )
    .transform(([field, direction]) => ({ field, direction }))
    .optional()
    .catch(undefined),
  // Junk, arrays and absurd offsets all fall back to page 1 rather than a 500.
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

export default async function ApplicationsPage({
  searchParams,
}: ApplicationsPageProps) {
  // The (auth) layout only gates profile completeness, so this gates the role.
  const user = await requireManagerOrAdminOr404();

  const sp = await searchParams;
  const parsed = searchParamsSchema.parse(sp);
  const page = parsed.page ?? 1;

  const filters: ApplicationFilters = {
    positionId: parsed.positionId,
    status: parsed.status,
    userId: parsed.userId,
    q: parsed.q,
    sort: parsed.sort,
  };

  const hasActiveFilters = !!(
    filters.positionId ||
    filters.status ||
    filters.userId ||
    filters.q ||
    filters.sort
  );

  const positions = await getReviewablePositions(user);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Applications"
        description="Review and track submitted applications."
      />

      <ApplicationsToolbar
        positions={positions}
        filters={filters}
        hasActiveFilters={hasActiveFilters}
      />

      <Suspense
        key={JSON.stringify({ ...filters, page })}
        fallback={<ApplicationsTableSkeleton />}
      >
        <ApplicationsResults
          user={user}
          filters={filters}
          page={page}
          hasActiveFilters={hasActiveFilters}
        />
      </Suspense>
    </div>
  );
}
