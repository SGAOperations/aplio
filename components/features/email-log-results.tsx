import 'server-only';

import { getEmailLogs, getEmailLogsCount } from '@/prisma/data/emails';

import { EMAIL_LOG_PAGE_SIZE } from '@/lib/constants';
import type { EmailLogFilters } from '@/lib/types';
import { buildEmailLogHref, getPaginationBounds } from '@/lib/utils';

import { EmailLogTable } from '@/components/features/email-log-table';
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
    <div className="flex flex-col gap-3">
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
