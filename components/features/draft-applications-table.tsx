'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { type DataTableColumn } from '@/lib/data-table';
import {
  ACTION_ICONS,
  APPLICATION_STATUS_ICONS,
  STATE_ICONS,
} from '@/lib/icons';
import type {
  ApplicationSort,
  ApplicationSortDirection,
  DraftApplicationListItem,
} from '@/lib/types';
import { displayUserName } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { LocalTime } from '@/components/ui/local-time';

type DraftSortField = 'name' | 'date';

interface DraftApplicationsTableProps {
  applications: DraftApplicationListItem[];
  hasActiveFilters: boolean;
  sort?: ApplicationSort;
}

export function DraftApplicationsTable({
  applications,
  hasActiveFilters,
  sort,
}: DraftApplicationsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleSort(
    field: DraftSortField,
    direction: ApplicationSortDirection,
  ) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', `${field}:${direction}`);
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggleSort(field: DraftSortField) {
    const isActive = sort?.field === field;
    if (!isActive) {
      handleSort(field, field === 'date' ? 'desc' : 'asc');
    } else {
      handleSort(field, sort.direction === 'asc' ? 'desc' : 'asc');
    }
  }

  const COLUMNS: DataTableColumn<DraftApplicationListItem>[] = [
    {
      key: 'name',
      header: 'Applicant',
      sortAccessor: (a) => displayUserName(a.user),
      cell: (app) => (
        <>
          <span className="font-medium">{displayUserName(app.user)}</span>
          {app.user.name && (
            <span className="text-muted-foreground block text-xs">
              {app.user.email}
            </span>
          )}
        </>
      ),
    },
    {
      key: 'position',
      header: 'Position',
      cellClassName: 'text-muted-foreground',
      cell: (app) => (
        <Link
          href={`/positions/${app.position.id}`}
          className="hover:underline"
        >
          {app.position.title}
        </Link>
      ),
    },
    {
      key: 'started',
      header: 'Started',
      cellClassName: 'text-muted-foreground',
      cell: (app) => <LocalTime date={app.createdAt} precision="date" />,
    },
    {
      key: 'date',
      header: 'Last updated',
      sortAccessor: (a) => a.updatedAt,
      cellClassName: 'text-muted-foreground',
      cell: (app) => <LocalTime date={app.updatedAt} precision="date" />,
    },
  ];

  const emptyState = hasActiveFilters ? (
    <EmptyState
      icon={STATE_ICONS.noResults}
      title="No drafts match these filters"
      description="Try adjusting or clearing your filters."
      action={
        <Button variant="outline" asChild>
          <Link href="/manage/applications?status=draft">
            <ACTION_ICONS.clearFilters />
            Clear filters
          </Link>
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={APPLICATION_STATUS_ICONS.draft}
      title="No drafts in progress"
      description="You'll see them here as soon as someone starts an application."
    />
  );

  return (
    <DataTable
      rows={applications}
      columns={COLUMNS}
      getRowKey={(a) => a.id}
      caption="Drafts"
      emptyState={emptyState}
      sort={sort ? { key: sort.field, direction: sort.direction } : undefined}
      onSortToggle={(key) => toggleSort(key as DraftSortField)}
      mobileCard={(app) => (
        <div className="flex flex-col gap-1 p-4">
          <span className="font-medium">{displayUserName(app.user)}</span>
          {app.user.name && (
            <span className="text-muted-foreground truncate text-xs">
              {app.user.email}
            </span>
          )}
          <Link
            href={`/positions/${app.position.id}`}
            className="text-muted-foreground w-fit text-sm hover:underline"
          >
            {app.position.title}
          </Link>
          <span className="text-muted-foreground text-xs">
            Started <LocalTime date={app.createdAt} precision="date" /> ·
            Updated <LocalTime date={app.updatedAt} precision="date" />
          </span>
        </div>
      )}
    />
  );
}
