'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { APPLICATION_STATUS_OPTIONS } from '@/lib/constants';
import { ACTION_ICONS } from '@/lib/icons';
import type { ApplicationFilters, ReviewableApplicant } from '@/lib/types';
import { displayUserName } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import {
  DataTableToolbar,
  DataTableToolbarField,
} from '@/components/ui/data-table-toolbar';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ApplicationsToolbarProps {
  positions: { id: string; title: string }[];
  applicants: ReviewableApplicant[];
  filters: ApplicationFilters;
  hasActiveFilters: boolean;
}

export function ApplicationsToolbar({
  positions,
  applicants,
  filters,
  hasActiveFilters,
}: ApplicationsToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Only ambiguous names get the disambiguating email suffix.
  const applicantLabels = useMemo(() => {
    const nameCounts = new Map<string, number>();
    for (const a of applicants) {
      const key = displayUserName(a);
      nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
    }
    return new Map(
      applicants.map((a) => {
        const key = displayUserName(a);
        const label =
          (nameCounts.get(key) ?? 0) > 1 ? `${key} · ${a.email}` : key;
        return [a.id, label] as const;
      }),
    );
  }, [applicants]);

  // A stale or foreign deep link — keep it selected rather than falling back to the placeholder.
  const unknownApplicantId =
    filters.userId && !applicants.some((a) => a.id === filters.userId)
      ? filters.userId
      : undefined;

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  // Clears a stale closure's router.replace on unmount; a timer has no non-effect home.
  useEffect(() => () => clearTimeout(debounceTimer.current), []);

  // Tracks the input immediately, ahead of the debounced URL update.
  const [searchValue, setSearchValue] = useState(filters.q ?? '');

  function updateParam(key: string, value: string | undefined) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // A filter change while on page 4 must land on page 1, not an empty page.
    params.delete('page');
    // userId survives filter changes so the per-user deep link stays intact.
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSearch(value: string) {
    setSearchValue(value);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) {
        params.set('q', value.trim());
      } else {
        params.delete('q');
      }
      params.delete('page');
      // Use replace for search so typing doesn't spam history.
      router.replace(`${pathname}?${params.toString()}`);
    }, 300);
  }

  function clearSearch() {
    setSearchValue('');
    clearTimeout(debounceTimer.current);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('q');
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearFilters() {
    setSearchValue('');
    // Drops userId too, so a zero-result filter set isn't a per-user deep-link dead end.
    router.push(pathname);
  }

  return (
    <DataTableToolbar>
      <DataTableToolbarField
        label="Position"
        htmlFor="filter-position"
        className="w-full sm:w-48"
      >
        <Select
          value={filters.positionId ?? ''}
          onValueChange={(v) => updateParam('positionId', v || undefined)}
        >
          <SelectTrigger id="filter-position" className="w-full">
            <SelectValue placeholder="All positions" />
          </SelectTrigger>
          <SelectContent>
            {/* "All positions" clears the filter */}
            <SelectItem value="">All positions</SelectItem>
            {positions.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </DataTableToolbarField>

      <DataTableToolbarField
        label="Applicant"
        htmlFor="filter-applicant"
        className="w-full sm:w-56"
      >
        <Select
          value={filters.userId ?? ''}
          onValueChange={(v) => updateParam('userId', v || undefined)}
          disabled={applicants.length === 0}
        >
          <SelectTrigger id="filter-applicant" className="w-full">
            <SelectValue
              placeholder={
                applicants.length === 0 ? 'No applicants yet' : 'All applicants'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {/* "All applicants" clears the filter */}
            <SelectItem value="">All applicants</SelectItem>
            {unknownApplicantId && (
              <SelectItem value={unknownApplicantId}>
                Unknown applicant
              </SelectItem>
            )}
            {applicants.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {applicantLabels.get(a.id)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </DataTableToolbarField>

      <DataTableToolbarField
        label="Status"
        htmlFor="filter-status"
        className="w-full sm:w-44"
      >
        <Select
          value={filters.status ?? ''}
          onValueChange={(v) => updateParam('status', v || undefined)}
        >
          <SelectTrigger id="filter-status" className="w-full">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {/* "All statuses" clears the filter */}
            <SelectItem value="">All statuses</SelectItem>
            {APPLICATION_STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </DataTableToolbarField>

      <DataTableToolbarField
        label="Search"
        htmlFor="filter-search"
        className="w-full sm:w-64"
      >
        <div className="relative">
          <Input
            id="filter-search"
            aria-label="Search applications"
            placeholder="Name, email, position, or date"
            value={searchValue}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pr-12 md:pr-9"
          />
          {searchValue && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Clear search"
              onClick={clearSearch}
              className="absolute top-1/2 right-1 -translate-y-1/2 md:size-7"
            >
              <ACTION_ICONS.dismiss />
            </Button>
          )}
        </div>
      </DataTableToolbarField>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="w-full sm:w-auto"
        >
          <ACTION_ICONS.clearFilters />
          Clear filters
        </Button>
      )}
    </DataTableToolbar>
  );
}
