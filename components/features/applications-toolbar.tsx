'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { X } from 'lucide-react';

import { REVIEWER_APPLICATION_STATUS_OPTIONS } from '@/lib/constants';
import type { ApplicationFilters, ReviewableApplicant } from '@/lib/types';

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
      const key = a.name ?? a.email;
      nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
    }
    return new Map(
      applicants.map((a) => {
        const key = a.name ?? a.email;
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
    // p-1: overflow-x-auto forces overflow-y auto too, which would clip focus rings.
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
          <Label htmlFor="filter-applicant" className="text-xs">
            Applicant
          </Label>
          <Select
            value={filters.userId ?? ''}
            onValueChange={(v) => updateParam('userId', v || undefined)}
            disabled={applicants.length === 0}
          >
            <SelectTrigger id="filter-applicant" className="w-56">
              <SelectValue
                placeholder={
                  applicants.length === 0
                    ? 'No applicants yet'
                    : 'All applicants'
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
