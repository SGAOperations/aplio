'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { FileText, Inbox } from 'lucide-react';

import type { $Enums } from '@/prisma/client';

import type {
  ApplicationListRow,
  ApplicationSort,
  ApplicationSortDirection,
  ApplicationSortField,
} from '@/lib/types';
import { getRenamedTo } from '@/lib/utils';

import { ApplicationStatusActions } from '@/components/features/application-status-actions';
import { ApplicationsBulkBar } from '@/components/features/applications-bulk-bar';
// Server-side sort; its param format stays decoupled from useSortableTable's.
import { SortableHeader } from '@/components/features/sortable-header';
import { ApplicationStatusBadge } from '@/components/features/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { LocalTime } from '@/components/ui/local-time';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
    // Re-fetches server-side: a 100-row cap can't be sorted correctly on the client.
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

  if (applications.length === 0) {
    if (hasActiveFilters)
      return (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <FileText
              className="text-muted-foreground size-12"
              aria-hidden="true"
            />
            <div>
              <p className="text-base font-semibold">
                No applications match these filters
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                Try adjusting or clearing your filters.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/applications">Clear filters</Link>
            </Button>
          </CardContent>
        </Card>
      );

    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <Inbox className="text-muted-foreground size-12" aria-hidden="true" />
          <div>
            <p className="text-base font-semibold">No applications yet</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Applications will appear here once candidates apply.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

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

      {/* overflow-hidden clips the header hover highlight to the card's rounded corners */}
      <Card className="gap-0 overflow-hidden p-0">
        {/* Desktop table — hidden on mobile */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={isIndeterminate ? 'indeterminate' : allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all applications"
                  />
                </TableHead>
                <SortableHeader
                  label="Applicant"
                  active={sort?.field === 'name'}
                  direction={sort?.direction ?? 'asc'}
                  ariaSort={
                    sort?.field === 'name'
                      ? sort.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                  onToggle={() => toggleSort('name')}
                />
                <TableHead>Position</TableHead>
                <SortableHeader
                  label="Status"
                  active={sort?.field === 'status'}
                  direction={sort?.direction ?? 'asc'}
                  ariaSort={
                    sort?.field === 'status'
                      ? sort.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                  onToggle={() => toggleSort('status')}
                />
                <SortableHeader
                  label="Submitted"
                  active={sort?.field === 'date'}
                  direction={sort?.direction ?? 'asc'}
                  ariaSort={
                    sort?.field === 'date'
                      ? sort.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                  onToggle={() => toggleSort('date')}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((app) => {
                const displayName =
                  app.applicantName ?? app.user.name ?? app.user.email;
                const renamedTo = getRenamedTo(app);
                const isChecked = selectedIds.has(app.id);
                return (
                  <TableRow
                    key={app.id}
                    data-state={isChecked ? 'selected' : undefined}
                  >
                    <TableCell
                      onClick={(e) => e.stopPropagation()}
                      className="w-10"
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleOne(app.id)}
                        aria-label={`Select ${displayName}`}
                      />
                    </TableCell>
                    <TableCell>
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
                      {(app.applicantName ?? app.user.name) && (
                        <span className="text-muted-foreground block text-xs">
                          {app.user.email}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {app.position.title}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <ApplicationStatusBadge status={app.status} />
                        <ApplicationStatusActions
                          applicationId={app.id}
                          currentStatus={app.status}
                          applicantName={displayName}
                          compact
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <LocalTime date={app.submittedAt} precision="date" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Mobile stacked cards — shown only on mobile */}
        <div className="flex flex-col divide-y md:hidden">
          {applications.map((app) => {
            const displayName =
              app.applicantName ?? app.user.name ?? app.user.email;
            const renamedTo = getRenamedTo(app);
            const isChecked = selectedIds.has(app.id);
            return (
              <div key={app.id} className="flex gap-3 p-4">
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
                        compact
                      />
                    </div>
                  </div>
                  {(app.applicantName ?? app.user.name) && (
                    <span className="text-muted-foreground truncate text-xs">
                      {app.user.email}
                    </span>
                  )}
                  <span className="text-muted-foreground text-sm">
                    {app.position.title}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    <LocalTime date={app.submittedAt} precision="date" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
