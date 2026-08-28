'use client';

import Link from 'next/link';

import {
  APPLICATION_STATUS_LABELS,
  DELETED_APPLICATION_LABEL,
} from '@/lib/constants';
import { type DataTableColumn } from '@/lib/data-table';
import { CONCEPT_ICONS } from '@/lib/icons';
import { type MyApplicationListItem } from '@/lib/types';

import { MyApplicationPrimaryAction } from '@/components/features/my-application-primary-action';
import { MyApplicationRowActions } from '@/components/features/my-application-row-actions';
import { ApplicationStatusBadge } from '@/components/features/status-badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { LocalTime } from '@/components/ui/local-time';

interface MyApplicationsTableProps {
  applications: MyApplicationListItem[];
}

const COLUMNS: DataTableColumn<MyApplicationListItem>[] = [
  {
    key: 'position',
    header: 'Position',
    sortAccessor: (a) => a.position.title,
    cell: (a) =>
      a.deletedAt ? (
        <span className="text-muted-foreground font-medium">
          {a.position.title}
        </span>
      ) : (
        <Link
          href={`/my-applications/${a.id}`}
          className="font-medium hover:underline"
        >
          {a.position.title}
        </Link>
      ),
  },
  {
    key: 'status',
    header: 'Status',
    // Sort by human label A-Z so order matches what the user reads in the badge.
    sortAccessor: (a) =>
      a.deletedAt
        ? DELETED_APPLICATION_LABEL
        : APPLICATION_STATUS_LABELS[a.status],
    cell: (a) => (
      <ApplicationStatusBadge status={a.status} deletedAt={a.deletedAt} />
    ),
  },
  {
    key: 'applied',
    header: 'Applied',
    // Drafts get createdAt as submittedAt, so null here for the null-last sort.
    sortAccessor: (a) => (a.status === 'draft' ? null : a.submittedAt),
    cellClassName: 'text-muted-foreground',
    cell: (a) =>
      a.status === 'draft' ? (
        '—'
      ) : (
        <LocalTime date={a.submittedAt} precision="date" />
      ),
  },
  {
    key: 'action',
    header: 'Action',
    cell: (a) => (
      <div className="flex items-center gap-2">
        <MyApplicationPrimaryAction application={a} />
        <MyApplicationRowActions
          applicationId={a.id}
          status={a.status}
          positionTitle={a.position.title}
          deletedAt={a.deletedAt}
        />
      </div>
    ),
  },
];

export function MyApplicationsTable({
  applications,
}: MyApplicationsTableProps) {
  if (applications.length === 0)
    return (
      <EmptyState
        icon={CONCEPT_ICONS.myApplication}
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
    <DataTable
      rows={applications}
      columns={COLUMNS}
      getRowKey={(a) => a.id}
      caption="My applications"
      mobileCard={(app) => (
        <div className="flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between gap-2">
            {app.deletedAt ? (
              <span className="text-muted-foreground font-medium">
                {app.position.title}
              </span>
            ) : (
              <Link
                href={`/my-applications/${app.id}`}
                className="font-medium hover:underline"
              >
                {app.position.title}
              </Link>
            )}
            <ApplicationStatusBadge
              status={app.status}
              deletedAt={app.deletedAt}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-sm">
              {app.status === 'draft' ? (
                'Draft'
              ) : (
                <LocalTime date={app.submittedAt} precision="date" />
              )}
            </span>
            <div className="flex items-center gap-2">
              <MyApplicationPrimaryAction application={app} />
              <MyApplicationRowActions
                applicationId={app.id}
                status={app.status}
                positionTitle={app.position.title}
                deletedAt={app.deletedAt}
              />
            </div>
          </div>
        </div>
      )}
    />
  );
}
