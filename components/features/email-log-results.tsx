import 'server-only';

import { getEmailLogs, getEmailLogsCount } from '@/prisma/data/emails';

import { EMAIL_LOG_PAGE_SIZE } from '@/lib/constants';
import { DATA_TABLE_RESULTS_CLASS } from '@/lib/data-table';
import type { EmailLogFilters } from '@/lib/types';
import { buildEmailLogHref, getPaginationBounds } from '@/lib/utils';

import { EmailLogTable } from '@/components/features/email-log-table';
import {
  DataTableSkeleton,
  type DataTableSkeletonColumn,
} from '@/components/ui/data-table-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { TablePagination } from '@/components/ui/table-pagination';

interface EmailLogResultsProps {
  filters: EmailLogFilters;
  page: number;
  hasActiveFilters: boolean;
}

export async function EmailLogResults({
  filters,
  page,
  hasActiveFilters,
}: EmailLogResultsProps) {
  const [total, initialRows] = await Promise.all([
    getEmailLogsCount(filters),
    getEmailLogs(filters, page),
  ]);
  const bounds = getPaginationBounds({
    total,
    page,
    pageSize: EMAIL_LOG_PAGE_SIZE,
  });

  // Stale/bookmarked ?page= past the last page — clamp instead of a blank table.
  const rows =
    total > 0 && initialRows.length === 0 && bounds.currentPage !== page
      ? await getEmailLogs(filters, bounds.currentPage)
      : initialRows;

  return (
    <div className={DATA_TABLE_RESULTS_CLASS}>
      <EmailLogTable emails={rows} hasActiveFilters={hasActiveFilters} />
      <TablePagination
        buildHref={(p) => buildEmailLogHref(filters, p)}
        currentPage={bounds.currentPage}
        totalPages={bounds.totalPages}
        total={total}
        rangeStart={bounds.rangeStart}
        rangeEnd={bounds.rangeEnd}
        isFiltered={hasActiveFilters}
        noun="email"
      />
    </div>
  );
}

const EMAIL_LOG_SKELETON_COLUMNS: DataTableSkeletonColumn[] = [
  { head: 'w-32', cell: 'w-48', subCell: 'w-32', mobile: 'primary' },
  { head: 'w-24', mobile: 'hidden' },
  { head: 'w-40', mobile: 'line' },
  { head: 'w-20', shape: 'badge', mobile: 'trailing' },
  { head: 'w-24', mobile: 'line' },
];

export function EmailLogResultsSkeleton() {
  return (
    <div className={DATA_TABLE_RESULTS_CLASS}>
      <DataTableSkeleton
        columns={EMAIL_LOG_SKELETON_COLUMNS}
        mobileGap="gap-1"
      />
      {/* Single-page summary line only — multi-page controls row height is unknowable until fetch. */}
      <Skeleton className="h-5 w-56" />
    </div>
  );
}
