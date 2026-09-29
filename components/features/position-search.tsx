'use client';

import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

import { parseAsString, useQueryState } from 'nuqs';

import { matchesSearchQuery } from '@/lib/data-table';
import { STATE_ICONS } from '@/lib/icons';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

interface PositionSearchContextValue {
  query: string;
  setQuery: (value: string | null) => Promise<URLSearchParams>;
  isFiltering: boolean;
  matchIds: Set<string>;
  shown: number;
  total: number;
}

const PositionSearchContext = createContext<PositionSearchContextValue | null>(
  null,
);

export function usePositionSearch(): PositionSearchContextValue {
  const ctx = useContext(PositionSearchContext);
  if (!ctx)
    throw new Error('usePositionSearch used outside PositionSearchProvider');
  return ctx;
}

const QUERY_PARSER = parseAsString
  .withDefault('')
  .withOptions({ history: 'replace', shallow: true, scroll: false });

interface PositionSearchProviderProps {
  items: { id: string; title: string; description?: string }[];
  children: ReactNode;
}

export function PositionSearchProvider({
  items,
  children,
}: PositionSearchProviderProps) {
  const [query, setQuery] = useQueryState('q', QUERY_PARSER);

  const { isFiltering, matchIds, shown } = useMemo(() => {
    const isFiltering = query.trim() !== '';
    if (!isFiltering)
      return {
        isFiltering: false,
        matchIds: new Set<string>(),
        shown: items.length,
      };
    const ids = new Set<string>();
    for (const item of items)
      if (
        matchesSearchQuery(item.title, query) ||
        (item.description && matchesSearchQuery(item.description, query))
      )
        ids.add(item.id);
    return { isFiltering: true, matchIds: ids, shown: ids.size };
  }, [query, items]);

  return (
    <PositionSearchContext.Provider
      value={{
        query,
        setQuery,
        isFiltering,
        matchIds,
        shown,
        total: items.length,
      }}
    >
      {children}
    </PositionSearchContext.Provider>
  );
}

interface PositionSearchItemProps {
  id: string;
  children: ReactNode;
}

/** Hides its children when filtering and this id has no match. */
export function PositionSearchItem({ id, children }: PositionSearchItemProps) {
  const { isFiltering, matchIds } = usePositionSearch();
  if (isFiltering && !matchIds.has(id)) return null;
  return <>{children}</>;
}

interface PositionSearchGroupProps {
  ids: string[];
  children: ReactNode;
}

/** Hides its children when filtering and none of the ids match. */
export function PositionSearchGroup({
  ids,
  children,
}: PositionSearchGroupProps) {
  const { isFiltering, matchIds } = usePositionSearch();
  if (isFiltering && !ids.some((id) => matchIds.has(id))) return null;
  return <>{children}</>;
}

interface PositionSearchWhenIdleProps {
  children: ReactNode;
}

/** Renders only when the search field is empty. */
export function PositionSearchWhenIdle({
  children,
}: PositionSearchWhenIdleProps) {
  const { isFiltering } = usePositionSearch();
  if (isFiltering) return null;
  return <>{children}</>;
}

/** Renders a "no matches" empty state when filtering returns zero results. */
export function PositionSearchEmpty() {
  const { isFiltering, shown, total, query, setQuery } = usePositionSearch();
  if (!isFiltering || shown > 0 || total === 0) return null;
  return (
    <EmptyState
      icon={STATE_ICONS.noResults}
      title={`No positions match “${query.trim()}”`}
      description="Check the spelling or try a shorter search."
      action={
        <Button variant="outline" onClick={() => void setQuery(null)}>
          Clear search
        </Button>
      }
    />
  );
}
