'use client';

import { Inbox } from 'lucide-react';

import { APPLICATION_STATUS_LABELS } from '@/lib/constants';
import { type PositionApplicationListItem } from '@/lib/types';
import {
  type SortableColumn,
  useSortableTable,
} from '@/lib/use-sortable-table';
import { formatDate } from '@/lib/utils';

import { ApplicationStatusControl } from '@/components/features/application-status-control';
import { SortableHeader } from '@/components/features/sortable-header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface PositionApplicationsTableProps {
  applications: PositionApplicationListItem[];
}

const COLUMNS: SortableColumn<PositionApplicationListItem>[] = [
  { key: 'applicant', accessor: (a) => a.user.name ?? a.user.email },
  { key: 'submitted', accessor: (a) => a.submittedAt },
  // Sort by human label A-Z so order matches what the user reads in the status control.
  { key: 'status', accessor: (a) => APPLICATION_STATUS_LABELS[a.status] },
];

export function PositionApplicationsTable({
  applications,
}: PositionApplicationsTableProps) {
  const { sortedRows, sort, toggle, ariaSort } = useSortableTable(
    applications,
    COLUMNS,
  );

  if (applications.length === 0)
    return (
      <EmptyState
        icon={Inbox}
        title="No applications yet"
        description="Applications will appear here once candidates apply to this position."
      />
    );

  return (
    // overflow-hidden clips the header hover highlight to the card's rounded corners
    <Card className="gap-0 overflow-hidden p-0">
      {/* Desktop table — hidden on mobile */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader
                label="Applicant"
                sortKey="applicant"
                active={sort.key === 'applicant'}
                direction={sort.direction}
                ariaSort={ariaSort('applicant')}
                onToggle={() => toggle('applicant')}
              />
              <SortableHeader
                label="Submitted"
                sortKey="submitted"
                active={sort.key === 'submitted'}
                direction={sort.direction}
                ariaSort={ariaSort('submitted')}
                onToggle={() => toggle('submitted')}
              />
              <SortableHeader
                label="Status"
                sortKey="status"
                active={sort.key === 'status'}
                direction={sort.direction}
                ariaSort={ariaSort('status')}
                onToggle={() => toggle('status')}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((app) => {
              const displayName = app.user.name ?? app.user.email;
              return (
                <TableRow key={app.id}>
                  <TableCell>
                    <span className="font-medium">{displayName}</span>
                    {app.user.name && (
                      <span className="text-muted-foreground block text-xs">
                        {app.user.email}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(app.submittedAt)}
                  </TableCell>
                  <TableCell>
                    <ApplicationStatusControl
                      applicationId={app.id}
                      currentStatus={app.status}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile stacked cards — sort order from sortedRows reflects active sort */}
      <div className="flex flex-col divide-y md:hidden">
        {sortedRows.map((app) => {
          const displayName = app.user.name ?? app.user.email;
          return (
            <div key={app.id} className="flex flex-col gap-2 p-4">
              <div>
                <span className="font-medium">{displayName}</span>
                {app.user.name && (
                  <span className="text-muted-foreground block text-xs">
                    {app.user.email}
                  </span>
                )}
              </div>
              <span className="text-muted-foreground text-sm">
                {formatDate(app.submittedAt)}
              </span>
              <ApplicationStatusControl
                applicationId={app.id}
                currentStatus={app.status}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
