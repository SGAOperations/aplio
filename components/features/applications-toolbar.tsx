'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { X } from 'lucide-react';

import { REVIEWER_APPLICATION_STATUS_OPTIONS } from '@/lib/constants';
import type { ApplicationFilters } from '@/lib/types';
import { formatTableCount } from '@/lib/utils';

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
  shown: number;
  total: number;
  shownCapped: boolean;
  hasActiveFilters: boolean;
}

export function ApplicationsToolbar({
  positions,
  filters,
  shown,
  total,
  shownCapped,
  hasActiveFilters,
}: ApplicationsToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  // Navigating away inside the debounce window would otherwise fire the stale
  // closure's router.replace. A timer handle has no non-effect home.
  useEffect(() => () => clearTimeout(debounceTimer.current), []);

  // Local state so the X button tracks the input immediately, rather than waiting
  // for the debounce to reach the URL.
  const [searchValue, setSearchValue] = useState(filters.q ?? '');

  function updateParam(key: string, value: string | undefined) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
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
    // Drops userId too, so a zero-result filter set isn't a dead end inside the
    // per-user deep link.
    router.push(pathname);
  }

  return (
    // p-1 keeps 3px focus rings clear of the box: overflow-x auto forces overflow-y
    // to auto per spec, which would silently clip them.
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

        <p
          aria-live="polite"
          className="text-muted-foreground self-end text-sm sm:ml-auto"
        >
          {formatTableCount({
            shown,
            total,
            noun: 'application',
            shownCapped,
            isFiltered: hasActiveFilters,
          })}
        </p>
      </div>
    </div>
  );
}
