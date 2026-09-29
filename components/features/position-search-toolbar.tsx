'use client';

import type { KeyboardEvent } from 'react';

import { ACTION_ICONS } from '@/lib/icons';
import { formatTableCount } from '@/lib/utils';

import { usePositionSearch } from '@/components/features/position-search';
import { Button } from '@/components/ui/button';
import {
  DataTableToolbar,
  DataTableToolbarField,
} from '@/components/ui/data-table-toolbar';
import { Input } from '@/components/ui/input';

interface PositionSearchToolbarProps {
  id: string;
}

export function PositionSearchToolbar({ id }: PositionSearchToolbarProps) {
  const { query, setQuery, isFiltering, shown, total } = usePositionSearch();

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape' && query) void setQuery(null);
  }

  return (
    <DataTableToolbar>
      <DataTableToolbarField label="Search" htmlFor={id} className="sm:w-64">
        <div className="relative">
          <Input
            id={id}
            placeholder="Search by title"
            autoComplete="off"
            value={query}
            onChange={(e) => void setQuery(e.target.value || null)}
            onKeyDown={handleKeyDown}
            className="w-full pr-12 md:pr-9"
          />
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Clear search"
              onClick={() => void setQuery(null)}
              className="absolute top-1/2 right-1 -translate-y-1/2 md:size-7"
            >
              <ACTION_ICONS.dismiss />
            </Button>
          )}
        </div>
      </DataTableToolbarField>
      <p
        aria-live="polite"
        className="text-muted-foreground w-full text-sm sm:ml-auto sm:w-auto sm:self-end"
      >
        {formatTableCount({
          shown,
          total,
          noun: 'position',
          isFiltered: isFiltering,
        })}
      </p>
    </DataTableToolbar>
  );
}
