'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useRef } from 'react';

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

  const hasActiveFilters = !!(
    filters.positionId ||
    filters.status ||
    filters.q
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

  function clearFilters() {
    const params = new URLSearchParams();
    // Preserve userId if present — the deep-link remains active after clearing.
    const userId = searchParams.get('userId');
    if (userId) params.set('userId', userId);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
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
        <Input
          id="filter-search"
          aria-label="Search applications"
          placeholder="Search by name or email"
          defaultValue={filters.q ?? ''}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-56"
        />
      </div>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
