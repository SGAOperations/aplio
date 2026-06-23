'use client';

import Link from 'next/link';
import { useState } from 'react';

import { FileText, Inbox } from 'lucide-react';

import type { $Enums } from '@/prisma/client';

import type { ApplicationListRow } from '@/lib/types';
import { formatDate } from '@/lib/utils';

import { ApplicationsBulkBar } from '@/components/features/applications-bulk-bar';
import { ApplicationStatusBadge } from '@/components/features/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
}

export function ApplicationsTable({
  applications,
  hasActiveFilters,
}: ApplicationsTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<$Enums.ApplicationStatus | ''>(
    '',
  );

  const allIds = applications.map((a) => a.id);
  const allSelected =
    allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = allIds.some((id) => selectedIds.has(id));
  const isIndeterminate = someSelected && !allSelected;

  // Drop ids no longer in the current view (e.g. after a filter change).
  const visibleSelected = Array.from(selectedIds).filter((id) =>
    allIds.includes(id),
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

  function clearSelection() {
    setSelectedIds(new Set());
    setBulkStatus('');
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
      {visibleSelected.length > 0 && (
        <ApplicationsBulkBar
          selectedIds={visibleSelected}
          onApplied={clearSelection}
          status={bulkStatus}
          onStatusChange={setBulkStatus}
        />
      )}

      <Card className="gap-0 p-0">
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
                <TableHead>Applicant</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((app) => {
                const displayName = app.user.name ?? app.user.email;
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
                      {app.user.name && (
                        <span className="text-muted-foreground block text-xs">
                          {app.user.email}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {app.position.title}
                    </TableCell>
                    <TableCell>
                      <ApplicationStatusBadge status={app.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(app.submittedAt)}
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
            const displayName = app.user.name ?? app.user.email;
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
                    <Link
                      href={`/applications/${app.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {displayName}
                    </Link>
                    <ApplicationStatusBadge status={app.status} />
                  </div>
                  {app.user.name && (
                    <span className="text-muted-foreground truncate text-xs">
                      {app.user.email}
                    </span>
                  )}
                  <span className="text-muted-foreground text-sm">
                    {app.position.title}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {formatDate(app.submittedAt)}
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
