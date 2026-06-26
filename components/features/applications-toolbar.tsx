'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';

import { X } from 'lucide-react';

import { REVIEWER_APPLICATION_STATUS_OPTIONS } from '@/lib/constants';
import type { ApplicationFilters } from '@/lib/types';

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

  // Track the search input value in local state so the X button reflects the
  // current input value both on initial page load (from URL param) and after
  // typing (without waiting for the debounce to update the URL).
  const [searchValue, setSearchValue] = useState(filters.q ?? '');

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
    setSearchValue(value);
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
    setSearchValue('');
    clearTimeout(debounceTimer.current);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('q');
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearFilters() {
    setSearchValue('');
    // Drop all filters including userId so the user can escape the deep-link
    // context (#77) when the filter set returns zero results.
    router.push(pathname);
  }

  return (
    // w-full spans the full content column to match the table sibling below.
    // p-1 gives ≥3px clearance on all sides so 3px focus rings (input.tsx,
    // select.tsx) are not clipped: overflow-x: auto forces overflow-y to auto
    // per the CSS spec, silently clipping any ring bleed outside the box.
    // min-w-0 + overflow-x-auto preserve narrow-viewport horizontal scrolling.
    <div className="w-full min-w-0 overflow-x-auto p-1">
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
              value={searchValue}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-64 pr-8"
            />
            {searchValue && (
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

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
