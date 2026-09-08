import Link from 'next/link';

import { EMAIL_TEMPLATE_LABELS } from '@/lib/constants';
import { type DataTableColumn } from '@/lib/data-table';
import { ACTION_ICONS, CONCEPT_ICONS, STATE_ICONS } from '@/lib/icons';
import type { EmailLogListItem } from '@/lib/types';
import { formatBounceType, getEmailLogTimestamp } from '@/lib/utils';

import { EmailStatusBadge } from '@/components/features/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { LocalTime } from '@/components/ui/local-time';

interface EmailLogTableProps {
  emails: EmailLogListItem[];
  hasActiveFilters: boolean;
}

function bounceBadgeVariant(bounceType: string) {
  if (bounceType === 'Permanent') return 'destructive' as const;
  if (bounceType === 'Transient') return 'warning' as const;
  return 'outline' as const;
}

// No sortAccessor on any column — rows are one server-ordered page, so a
// client-side sort of 50 of N rows would lie about the true order.
const COLUMNS: DataTableColumn<EmailLogListItem>[] = [
  {
    key: 'recipient',
    header: 'Recipient',
    cell: (row) => (
      <>
        <span className="font-medium break-all">{row.to}</span>
        {row.user?.name && (
          <span className="text-muted-foreground block text-xs">
            {row.user.name}
          </span>
        )}
      </>
    ),
  },
  {
    key: 'template',
    header: 'Template',
    cellClassName: 'text-muted-foreground',
    cell: (row) => EMAIL_TEMPLATE_LABELS[row.template],
  },
  {
    key: 'subject',
    header: 'Subject',
    cell: (row) => (
      <span className="line-clamp-2" title={row.subject}>
        {row.subject}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    cell: (row) => {
      const bounceType = formatBounceType(row.bounceType);
      return (
        <div className="flex flex-col items-start gap-1">
          <EmailStatusBadge status={row.status} />
          {bounceType && (
            <Badge variant={bounceBadgeVariant(bounceType)}>{bounceType}</Badge>
          )}
          {row.error && (
            <span className="text-muted-foreground line-clamp-2 text-xs">
              {row.error}
            </span>
          )}
        </div>
      );
    },
  },
  {
    key: 'when',
    header: 'When',
    cellClassName: 'text-muted-foreground',
    cell: (row) => {
      const { date, label } = getEmailLogTimestamp(row);
      return (
        <>
          <LocalTime date={date} precision="datetime" />
          <span className="text-muted-foreground block text-xs">{label}</span>
        </>
      );
    },
  },
];

export function EmailLogTable({
  emails,
  hasActiveFilters,
}: EmailLogTableProps) {
  const emptyState = hasActiveFilters ? (
    <EmptyState
      icon={STATE_ICONS.noResults}
      title="No emails match these filters"
      description="Try adjusting or clearing your filters."
      action={
        <Button variant="outline" asChild>
          <Link href="/emails">
            <ACTION_ICONS.clearFilters />
            Clear filters
          </Link>
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={CONCEPT_ICONS.email}
      title="No emails yet"
      description="Every email Aplio sends will appear here, including sign-in codes."
    />
  );

  return (
    <DataTable
      rows={emails}
      columns={COLUMNS}
      getRowKey={(row) => row.id}
      caption="Email log"
      emptyState={emptyState}
      mobileCard={(row) => {
        const { date, label } = getEmailLogTimestamp(row);
        const bounceType = formatBounceType(row.bounceType);
        return (
          <div className="flex flex-col gap-1 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="block font-medium break-all">{row.to}</span>
                {row.user?.name && (
                  <span className="text-muted-foreground block text-xs">
                    {row.user.name}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <EmailStatusBadge status={row.status} />
                {bounceType && (
                  <Badge variant={bounceBadgeVariant(bounceType)}>
                    {bounceType}
                  </Badge>
                )}
              </div>
            </div>
            <span className="line-clamp-2 text-sm">{row.subject}</span>
            <span className="text-muted-foreground text-xs">
              {EMAIL_TEMPLATE_LABELS[row.template]} · {label}{' '}
              <LocalTime date={date} precision="datetime" />
            </span>
            {row.error && (
              <span className="text-muted-foreground line-clamp-2 text-xs">
                {row.error}
              </span>
            )}
          </div>
        );
      }}
    />
  );
}
