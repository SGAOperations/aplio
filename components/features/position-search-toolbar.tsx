'use client';

import type { KeyboardEvent } from 'react';

import { ACTION_ICONS } from '@/lib/icons';

import { usePositionSearch } from '@/components/features/position-search';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PositionSearchToolbarProps {
  id: string;
}

export function PositionSearchToolbar({ id }: PositionSearchToolbarProps) {
  const { query, setQuery } = usePositionSearch();

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape' && query) void setQuery(null);
  }

  return (
    <div className="relative sm:w-64">
      <Input
        id={id}
        placeholder="Search by title"
        autoComplete="off"
        aria-label="Search positions"
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
  );
}
