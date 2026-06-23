import { redirect } from 'next/navigation';

import {
  getApplications,
  getReviewablePositions,
} from '@/prisma/data/applications';

import { getCurrentUser } from '@/lib/auth/server';
import { REVIEWER_APPLICATION_STATUSES } from '@/lib/constants';
import prisma from '@/lib/prisma';
import type { ApplicationFilters, ReviewerStatus } from '@/lib/types';

import { ApplicationsTable } from '@/components/features/applications-table';
import { ApplicationsToolbar } from '@/components/features/applications-toolbar';

interface ApplicationsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ApplicationsPage({
  searchParams,
}: ApplicationsPageProps) {
  const user = await getCurrentUser();

  // Authorization guard: admins pass; managers pass only while they have ≥1 position.
  // Regular applicants are redirected to home — the (auth) layout is not sufficient.
  if (!user.isAdmin) {
    const managed = await prisma.position.count({
      where: { managers: { some: { id: user.id } }, deletedAt: null },
    });
    if (managed === 0) redirect('/');
  }

  const sp = await searchParams;

  // Parse filters from searchParams — unknown/invalid values are ignored.
  const rawStatus = typeof sp.status === 'string' ? sp.status : undefined;
  const validStatus: ReviewerStatus | undefined =
    rawStatus &&
    (REVIEWER_APPLICATION_STATUSES as readonly string[]).includes(rawStatus)
      ? (rawStatus as ReviewerStatus)
      : undefined;

  const filters: ApplicationFilters = {
    positionId: typeof sp.positionId === 'string' ? sp.positionId : undefined,
    status: validStatus,
    userId: typeof sp.userId === 'string' ? sp.userId : undefined,
    q: typeof sp.q === 'string' && sp.q.trim() ? sp.q.trim() : undefined,
  };

  const hasActiveFilters = !!(
    filters.positionId ||
    filters.status ||
    filters.q
  );

  const [applications, positions] = await Promise.all([
    getApplications(user, filters),
    getReviewablePositions(user),
  ]);

  const count = applications.length;
  const countLabel =
    count === 1 ? '1 application' : count > 0 ? `${count} applications` : null;

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
      />
    </div>
  );
}
