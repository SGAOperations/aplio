'use client';

import Link from 'next/link';

import { FileText } from 'lucide-react';

import { APPLICATION_STATUS_LABELS } from '@/lib/constants';
import { type MyApplicationListItem } from '@/lib/types';
import {
  type SortableColumn,
  useSortableTable,
} from '@/lib/use-sortable-table';
import { formatDate } from '@/lib/utils';

import { MyApplicationRowActions } from '@/components/features/my-application-row-actions';
import { SortableHeader } from '@/components/features/sortable-header';
import { ApplicationStatusBadge } from '@/components/features/status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface MyApplicationsTableProps {
  applications: MyApplicationListItem[];
}

const COLUMNS: SortableColumn<MyApplicationListItem>[] = [
  { key: 'position', accessor: (a) => a.position.title },
  // Sort by human label A-Z so order matches what the user reads in the badge.
  { key: 'status', accessor: (a) => APPLICATION_STATUS_LABELS[a.status] },
  // Drafts have null submittedAt — they sort last (null-last rule in the hook).
  { key: 'applied', accessor: (a) => a.submittedAt },
];

export function MyApplicationsTable({
  applications,
}: MyApplicationsTableProps) {
  const { sortedRows, sort, toggle, ariaSort } = useSortableTable(
    applications,
    COLUMNS,
  );

  if (applications.length === 0)
    return (
      <EmptyState
        icon={FileText}
        title="No applications yet"
        description="Browse open positions to start your first application."
        action={
          <Button asChild>
            <Link href="/positions">Browse positions</Link>
          </Button>
        }
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
                label="Position"
                sortKey="position"
                active={sort.key === 'position'}
                direction={sort.direction}
                ariaSort={ariaSort('position')}
                onToggle={() => toggle('position')}
              />
              <SortableHeader
                label="Status"
                sortKey="status"
                active={sort.key === 'status'}
                direction={sort.direction}
                ariaSort={ariaSort('status')}
                onToggle={() => toggle('status')}
              />
              <SortableHeader
                label="Applied"
                sortKey="applied"
                active={sort.key === 'applied'}
                direction={sort.direction}
                ariaSort={ariaSort('applied')}
                onToggle={() => toggle('applied')}
              />
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((app) => (
              <TableRow key={app.id}>
                <TableCell>
                  <Link
                    href={`/positions/${app.positionId}`}
                    className="font-medium hover:underline"
                  >
                    {app.position.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <ApplicationStatusBadge status={app.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {app.status === 'draft' ? '—' : formatDate(app.submittedAt)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {app.status === 'draft' && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/positions/${app.positionId}/apply`}>
                          Continue
                        </Link>
                      </Button>
                    )}
                    <MyApplicationRowActions
                      applicationId={app.id}
                      status={app.status}
                      positionTitle={app.position.title}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile stacked cards — sort order from sortedRows reflects active sort */}
      <div className="flex flex-col divide-y md:hidden">
        {sortedRows.map((app) => (
          <div key={app.id} className="flex flex-col gap-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/positions/${app.positionId}`}
                className="font-medium hover:underline"
              >
                {app.position.title}
              </Link>
              <ApplicationStatusBadge status={app.status} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-sm">
                {app.status === 'draft' ? 'Draft' : formatDate(app.submittedAt)}
              </span>
              <div className="flex items-center gap-2">
                {app.status === 'draft' && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/positions/${app.positionId}/apply`}>
                      Continue
                    </Link>
                  </Button>
                )}
                <MyApplicationRowActions
                  applicationId={app.id}
                  status={app.status}
                  positionTitle={app.position.title}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
