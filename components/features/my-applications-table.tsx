'use client';

import Link from 'next/link';
import { useMemo } from 'react';

import { APPLICATION_STATUS_LABELS } from '@/lib/constants';
import { type DataTableColumn } from '@/lib/data-table';
import { CONCEPT_ICONS } from '@/lib/icons';
import { type MyApplicationListItem } from '@/lib/types';
import { getDeadlineInfo } from '@/lib/utils';

import { DeadlineIndicator } from '@/components/features/deadline-indicator';
import { MyApplicationPrimaryAction } from '@/components/features/my-application-primary-action';
import { MyApplicationRowActions } from '@/components/features/my-application-row-actions';
import { ApplicationStatusBadge } from '@/components/features/status-badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { LocalTime } from '@/components/ui/local-time';

interface MyApplicationsTableProps {
  applications: MyApplicationListItem[];
  now: Date;
}

function buildColumns(now: Date): DataTableColumn<MyApplicationListItem>[] {
  return [
    {
      key: 'position',
      header: 'Position',
      sortAccessor: (a) => a.position.title,
      cell: (a) => (
        <Link
          href={`/applications/${a.id}`}
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
      sortAccessor: (a) => APPLICATION_STATUS_LABELS[a.status],
      cell: (a) => <ApplicationStatusBadge status={a.status} />,
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
      key: 'deadline',
      header: 'Deadline',
      // Sorts by the date the cell actually shows (Opens/Closes/Closed), not raw closesAt.
      sortAccessor: (a) => getDeadlineInfo(a.position, now)?.date ?? null,
      cell: (a) => (
        <DeadlineIndicator
          position={a.position}
          now={now}
          emphasizeUrgency={a.status === 'draft'}
        />
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
          />
        </div>
      ),
    },
  ];
}

// Date only for a draft whose deadline tier is soon/urgent — the float target.
function atRiskDeadlineDate(a: MyApplicationListItem, now: Date): Date | null {
  if (a.status !== 'draft') return null;
  const info = getDeadlineInfo(a.position, now);
  if (info?.tier !== 'soon' && info?.tier !== 'urgent') return null;
  return info.date;
}

export function MyApplicationsTable({
  applications,
  now,
}: MyApplicationsTableProps) {
  const columns = useMemo(() => buildColumns(now), [now]);

  // At-risk drafts float to the top, nearest deadline first; everything else
  // keeps its incoming order. No defaultSort — sort.key stays null so a
  // header click takes over completely.
  const rows = useMemo(() => {
    const atRisk = applications
      .map((a) => ({ a, date: atRiskDeadlineDate(a, now) }))
      .filter((x): x is { a: MyApplicationListItem; date: Date } =>
        Boolean(x.date),
      )
      .sort((x, y) => x.date.getTime() - y.date.getTime())
      .map((x) => x.a);
    const atRiskIds = new Set(atRisk.map((a) => a.id));
    const rest = applications.filter((a) => !atRiskIds.has(a.id));
    return [...atRisk, ...rest];
  }, [applications, now]);

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
      rows={rows}
      columns={columns}
      getRowKey={(a) => a.id}
      caption="My applications"
      mobileCard={(app) => (
        <div className="flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <Link
              href={`/applications/${app.id}`}
              className="font-medium hover:underline"
            >
              {app.position.title}
            </Link>
            <ApplicationStatusBadge status={app.status} />
          </div>
          <DeadlineIndicator
            position={app.position}
            now={now}
            emphasizeUrgency={app.status === 'draft'}
          />
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
              />
            </div>
          </div>
        </div>
      )}
    />
  );
}
