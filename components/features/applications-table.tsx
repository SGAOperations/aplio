'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import type { $Enums } from '@/prisma/client';

import { type DataTableColumn } from '@/lib/data-table';
import { ACTION_ICONS, CONCEPT_ICONS, STATE_ICONS } from '@/lib/icons';
import type {
  ApplicationListRow,
  ApplicationSort,
  ApplicationSortDirection,
  ApplicationSortField,
} from '@/lib/types';
import { getApplicantName, getDisplayName, getRenamedTo } from '@/lib/utils';

import { ApplicationStatusActions } from '@/components/features/application-status-actions';
import { ApplicationsBulkBar } from '@/components/features/applications-bulk-bar';
import { ApplicationStatusBadge } from '@/components/features/status-badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { LocalTime } from '@/components/ui/local-time';

interface ApplicationsTableProps {
  applications: ApplicationListRow[];
  hasActiveFilters: boolean;
  sort?: ApplicationSort;
}

export function ApplicationsTable({
  applications,
  hasActiveFilters,
  sort,
}: ApplicationsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<$Enums.ApplicationStatus | ''>(
    '',
  );

  const allIds = applications.map((a) => a.id);
  const allSelected =
    allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = allIds.some((id) => selectedIds.has(id));
  const isIndeterminate = someSelected && !allSelected;

  // Drops ids no longer in the current view (e.g. after a filter change).
  const selectedRows = applications.filter((a) => selectedIds.has(a.id));

  // Derived once per row and reused across cells/mobileCard.
  const displayInfo = useMemo(
    () =>
      new Map(
        applications.map((app) => [
          app.id,
          { displayName: getDisplayName(app), renamedTo: getRenamedTo(app) },
        ]),
      ),
    [applications],
  );

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  }

  // Retains skipped rows post-apply so the user can see what still needs action.
  function handleApplied(retainedIds: string[]) {
    setSelectedIds(new Set(retainedIds));
    setBulkStatus('');
  }

  function handleSort(
    field: ApplicationSortField,
    direction: ApplicationSortDirection,
  ) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', `${field}:${direction}`);
    // A sort change while on page 4 must land on page 1, not an empty page.
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggleSort(field: ApplicationSortField) {
    const isActive = sort?.field === field;
    if (!isActive) {
      // Default to desc for date (newest first), asc for name/status (A-Z).
      handleSort(field, field === 'date' ? 'desc' : 'asc');
    } else {
      handleSort(field, sort.direction === 'asc' ? 'desc' : 'asc');
    }
  }

  const COLUMNS: DataTableColumn<ApplicationListRow>[] = [
    {
      key: 'select',
      header: (
        <Checkbox
          checked={isIndeterminate ? 'indeterminate' : allSelected}
          onCheckedChange={toggleAll}
          aria-label="Select all applications"
        />
      ),
      headClassName: 'w-10',
      cellClassName: 'w-10',
      cell: (app) => {
        const { displayName } = displayInfo.get(app.id)!;
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={selectedIds.has(app.id)}
              onCheckedChange={() => toggleOne(app.id)}
              aria-label={`Select ${displayName}`}
            />
          </div>
        );
      },
    },
    {
      key: 'name',
      header: 'Applicant',
      sortAccessor: (a) => getDisplayName(a),
      cell: (app) => {
        const { displayName, renamedTo } = displayInfo.get(app.id)!;
        return (
          <>
            <Link
              href={`/applications/${app.id}`}
              className="font-medium hover:underline"
            >
              {displayName}
            </Link>
            {renamedTo && (
              <span className="text-muted-foreground ml-1 text-xs">
                ({renamedTo})
              </span>
            )}
            {getApplicantName(app) && (
              <span className="text-muted-foreground block text-xs">
                {app.user.email}
              </span>
            )}
          </>
        );
      },
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
      key: 'status',
      header: 'Status',
      sortAccessor: (a) => a.status,
      cell: (app) => {
        const { displayName } = displayInfo.get(app.id)!;
        return (
          <div className="flex items-center gap-1">
            <ApplicationStatusBadge status={app.status} />
            <ApplicationStatusActions
              applicationId={app.id}
              currentStatus={app.status}
              applicantName={displayName}
            />
          </div>
        );
      },
    },
    {
      key: 'date',
      header: 'Submitted',
      sortAccessor: (a) => a.submittedAt,
      cellClassName: 'text-muted-foreground',
      cell: (app) => <LocalTime date={app.submittedAt} precision="date" />,
    },
  ];

  const emptyState = hasActiveFilters ? (
    <EmptyState
      icon={STATE_ICONS.noResults}
      title="No applications match these filters"
      description="Try adjusting or clearing your filters."
      action={
        <Button variant="outline" asChild>
          <Link href="/applications">
            <ACTION_ICONS.clearFilters />
            Clear filters
          </Link>
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={CONCEPT_ICONS.application}
      title="No applications yet"
      description="Applications will appear here once candidates apply."
    />
  );

  return (
    <div className="flex flex-col gap-3">
      {selectedRows.length > 0 && (
        <ApplicationsBulkBar
          selected={selectedRows}
          onApplied={handleApplied}
          status={bulkStatus}
          onStatusChange={setBulkStatus}
        />
      )}

      <DataTable
        rows={applications}
        columns={COLUMNS}
        getRowKey={(a) => a.id}
        caption="Applications"
        emptyState={emptyState}
        isRowSelected={(a) => selectedIds.has(a.id)}
        sort={sort ? { key: sort.field, direction: sort.direction } : undefined}
        onSortToggle={(key) => toggleSort(key as ApplicationSortField)}
        mobileCard={(app) => {
          const { displayName, renamedTo } = displayInfo.get(app.id)!;
          const isChecked = selectedIds.has(app.id);
          return (
            <div className="flex gap-3 p-4">
              <Checkbox
                checked={isChecked}
                onCheckedChange={() => toggleOne(app.id)}
                aria-label={`Select ${displayName}`}
                className="mt-0.5 shrink-0"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 truncate">
                    <Link
                      href={`/applications/${app.id}`}
                      className="font-medium hover:underline"
                    >
                      {displayName}
                    </Link>
                    {renamedTo && (
                      <span className="text-muted-foreground ml-1 text-xs">
                        ({renamedTo})
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <ApplicationStatusBadge status={app.status} />
                    <ApplicationStatusActions
                      applicationId={app.id}
                      currentStatus={app.status}
                      applicantName={displayName}
                    />
                  </div>
                </div>
                {getApplicantName(app) && (
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
                  <LocalTime date={app.submittedAt} precision="date" />
                </span>
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}
