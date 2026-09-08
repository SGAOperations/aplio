'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { EMAIL_STATUS_OPTIONS, EMAIL_TEMPLATE_OPTIONS } from '@/lib/constants';
import { ACTION_ICONS } from '@/lib/icons';
import type { EmailLogFilters } from '@/lib/types';

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

interface EmailLogToolbarProps {
  filters: EmailLogFilters;
  hasActiveFilters: boolean;
}

export function EmailLogToolbar({
  filters,
  hasActiveFilters,
}: EmailLogToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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
    clearTimeout(debounceTimer.current);
    router.push(pathname);
  }

  return (
    <DataTableToolbar>
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
            {EMAIL_STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </DataTableToolbarField>

      <DataTableToolbarField
        label="Template"
        htmlFor="filter-template"
        className="w-full sm:w-52"
      >
        <Select
          value={filters.template ?? ''}
          onValueChange={(v) => updateParam('template', v || undefined)}
        >
          <SelectTrigger id="filter-template" className="w-full">
            <SelectValue placeholder="All templates" />
          </SelectTrigger>
          <SelectContent>
            {/* "All templates" clears the filter */}
            <SelectItem value="">All templates</SelectItem>
            {EMAIL_TEMPLATE_OPTIONS.map((opt) => (
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
            aria-label="Search emails by recipient"
            placeholder="Search by recipient address"
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
