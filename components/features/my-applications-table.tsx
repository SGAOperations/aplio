'use client';

import Link from 'next/link';
import { useMemo } from 'react';

import {
  APPLICATION_STATUS_LABELS,
  TERMINAL_DECISION_STATUSES,
} from '@/lib/constants';
import { type DataTableColumn } from '@/lib/data-table';
import { CONCEPT_ICONS } from '@/lib/icons';
import {
  type ApplicationCompletion,
  type MyApplicationListItem,
} from '@/lib/types';
import { getDeadlineInfo } from '@/lib/utils';

import { DeadlineIndicator } from '@/components/features/deadline-indicator';
import { MyApplicationPrimaryAction } from '@/components/features/my-application-primary-action';
import { MyApplicationRowActions } from '@/components/features/my-application-row-actions';
import { ApplicationStatusBadge } from '@/components/features/status-badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { LocalTime } from '@/components/ui/local-time';
import { ProgressRing } from '@/components/ui/progress-ring';

interface MyApplicationsTableProps {
  applications: MyApplicationListItem[];
  now: Date;
  completion: Record<string, ApplicationCompletion>;
}

function buildColumns(
  now: Date,
  completion: Record<string, ApplicationCompletion>,
): DataTableColumn<MyApplicationListItem>[] {
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
      cell: (a) => {
        const entry = a.status === 'draft' ? completion[a.id] : undefined;
        return (
          <div className="flex items-center gap-1">
            <ApplicationStatusBadge status={a.status} />
            {entry && <ProgressRing percent={entry.percent} size="sm" />}
          </div>
        );
      },
    },
    {
      key: 'applied',
      header: 'Applied',
      sortAccessor: (a) => a.submittedAt,
      cellClassName: 'text-muted-foreground',
      cell: (a) =>
        a.submittedAt ? (
          <LocalTime date={a.submittedAt} precision="date" />
        ) : (
          '—'
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
          emphasizeUrgency={a.status === 'draft' || a.status === 'withdrawn'}
        />
      ),
    },
    {
      key: 'action',
      header: 'Action',
      cell: (a) =>
        TERMINAL_DECISION_STATUSES.includes(a.status) ? (
          <span className="text-muted-foreground text-sm" aria-hidden="true">
            —
          </span>
        ) : (
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

// Date only for a draft/withdrawn app whose deadline tier is soon/urgent — the float target.
function atRiskDeadlineDate(a: MyApplicationListItem, now: Date): Date | null {
  if (a.status !== 'draft' && a.status !== 'withdrawn') return null;
  const info = getDeadlineInfo(a.position, now);
  if (info?.tier !== 'soon' && info?.tier !== 'urgent') return null;
  return info.date;
}

export function MyApplicationsTable({
  applications,
  now,
  completion,
}: MyApplicationsTableProps) {
  const columns = useMemo(
    () => buildColumns(now, completion),
    [now, completion],
  );

  // At-risk drafts float to the top, nearest deadline first; sort.key stays null so a header click still takes over.
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
      mobileCard={(app) => {
        const entry = app.status === 'draft' ? completion[app.id] : undefined;
        return (
          <div className="flex flex-col gap-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/applications/${app.id}`}
                className="font-medium hover:underline"
              >
                {app.position.title}
              </Link>
              <div className="flex shrink-0 items-center gap-1">
                <ApplicationStatusBadge status={app.status} />
                {entry && <ProgressRing percent={entry.percent} size="sm" />}
              </div>
            </div>
            <DeadlineIndicator
              position={app.position}
              now={now}
              emphasizeUrgency={
                app.status === 'draft' || app.status === 'withdrawn'
              }
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-sm">
                {app.submittedAt ? (
                  <LocalTime date={app.submittedAt} precision="date" />
                ) : (
                  'Draft'
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
        );
      }}
    />
  );
}
