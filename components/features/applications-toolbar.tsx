'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useRef } from 'react';

import { X } from 'lucide-react';

import { REVIEWER_APPLICATION_STATUS_OPTIONS } from '@/lib/constants';
import type { ApplicationFilters, ApplicationSort } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ApplicationsToolbarProps {
  positions: { id: string; title: string }[];
  filters: ApplicationFilters;
}

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'date:desc', label: 'Newest first' },
  { value: 'date:asc', label: 'Oldest first' },
  { value: 'name:asc', label: 'Name A–Z' },
  { value: 'name:desc', label: 'Name Z–A' },
  { value: 'status:asc', label: 'Status A–Z' },
  { value: 'status:desc', label: 'Status Z–A' },
];

function sortToParam(sort: ApplicationSort | undefined): string {
  if (!sort) return '';
  return `${sort.field}:${sort.direction}`;
}

export function ApplicationsToolbar({
  positions,
  filters,
}: ApplicationsToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // useRef is the correct home for a timer handle in a client component — it
  // persists across renders without triggering re-renders, and avoids the
  // react-hooks/immutability lint error that a plain `let` produces.
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const hasActiveFilters = !!(
    filters.positionId ||
    filters.status ||
    filters.userId ||
    filters.q ||
    filters.sort
  );

  function updateParam(key: string, value: string | undefined) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Always preserve userId across filter changes (powers #77 deep-link).
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSearch(value: string) {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) {
        params.set('q', value.trim());
      } else {
        params.delete('q');
      }
      // Use replace for search so typing doesn't spam history.
      router.replace(`${pathname}?${params.toString()}`);
    }, 300);
  }

  function clearSearch() {
    clearTimeout(debounceTimer.current);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('q');
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearFilters() {
    // Drop all filters including userId so the user can escape the deep-link
    // context (#77) when the filter set returns zero results.
    router.push(pathname);
  }

  const currentSort = sortToParam(filters.sort);

  return (
    // min-w-0 prevents the toolbar from expanding the page when filter controls
    // change width; overflow-x-auto lets it scroll on very narrow viewports
    // instead of reflowing the surrounding layout.
    <div className="min-w-0 overflow-x-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-position" className="text-xs">
            Position
          </Label>
          <Select
            value={filters.positionId ?? ''}
            onValueChange={(v) => updateParam('positionId', v || undefined)}
          >
            <SelectTrigger id="filter-position" className="w-48">
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
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-status" className="text-xs">
            Status
          </Label>
          <Select
            value={filters.status ?? ''}
            onValueChange={(v) => updateParam('status', v || undefined)}
          >
            <SelectTrigger id="filter-status" className="w-44">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              {/* "All statuses" clears the filter */}
              <SelectItem value="">All statuses</SelectItem>
              {REVIEWER_APPLICATION_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-search" className="text-xs">
            Search
          </Label>
          <div className="relative">
            <Input
              id="filter-search"
              aria-label="Search applications"
              placeholder="Name, email, position, or date"
              defaultValue={filters.q ?? ''}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-64 pr-8"
            />
            {filters.q && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={clearSearch}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-sort" className="text-xs">
            Sort
          </Label>
          <Select
            value={currentSort}
            onValueChange={(v) => updateParam('sort', v || undefined)}
          >
            <SelectTrigger id="filter-sort" className="w-40">
              <SelectValue placeholder="Newest first" />
            </SelectTrigger>
            <SelectContent>
              {/* Empty value resets to default (newest first) */}
              <SelectItem value="">Default (newest)</SelectItem>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
