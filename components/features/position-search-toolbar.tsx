'use client';

import {
  type ChangeEvent,
  type KeyboardEvent,
  startTransition,
  useState,
} from 'react';

import { ACTION_ICONS } from '@/lib/icons';

import { usePositionSearch } from '@/components/features/position-search';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PositionSearchToolbarProps {
  id: string;
}

export function PositionSearchToolbar({ id }: PositionSearchToolbarProps) {
  const { query, setQuery } = usePositionSearch();
  const [localValue, setLocalValue] = useState(query);
  const [prevQuery, setPrevQuery] = useState(query);

  // sync with URL changes (e.g. browser back/forward) — derived-state-during-render
  if (query !== prevQuery) {
    setPrevQuery(query);
    setLocalValue(query);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setLocalValue(e.target.value);
    startTransition(() => {
      void setQuery(e.target.value || null);
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape' && localValue) {
      setLocalValue('');
      startTransition(() => {
        void setQuery(null);
      });
    }
  }

  function handleClear() {
    setLocalValue('');
    startTransition(() => {
      void setQuery(null);
    });
  }

  return (
    <div className="relative sm:w-64">
      <Input
        id={id}
        placeholder="Search by title or description"
        autoComplete="off"
        aria-label="Search positions by title or description"
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="w-full pr-12 md:pr-9"
      />
      {localValue && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Clear search"
          onClick={handleClear}
          className="absolute top-1/2 right-1 -translate-y-1/2 md:size-7"
        >
          <ACTION_ICONS.dismiss />
        </Button>
      )}
    </div>
  );
}
