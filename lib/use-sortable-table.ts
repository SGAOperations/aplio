'use client';

import { useCallback, useMemo } from 'react';

import { parseAsStringEnum, parseAsStringLiteral, useQueryStates } from 'nuqs';

export type SortDirection = 'asc' | 'desc';

// A column the table can sort by. `key` is the URL token; `accessor` extracts
// the comparable value from a row.
export interface SortableColumn<T> {
  key: string;
  accessor: (row: T) => string | number | Date | null | undefined;
}

export interface SortState {
  key: string | null;
  direction: SortDirection;
}

interface UseSortableTableOptions {
  defaultSort?: SortState;
}

interface UseSortableTableResult<T> {
  sortedRows: T[];
  sort: SortState;
  toggle: (key: string) => void;
  ariaSort: (key: string) => 'ascending' | 'descending' | 'none';
}

function compareValues(
  a: string | number | Date | null | undefined,
  b: string | number | Date | null | undefined,
): number {
  // Null/undefined always sort last regardless of direction.
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string')
    return a.localeCompare(b, undefined, {
      sensitivity: 'base',
      numeric: true,
    });

  // Fallback for mixed types — convert to string.
  return String(a).localeCompare(String(b), undefined, {
    sensitivity: 'base',
    numeric: true,
  });
}

export function useSortableTable<T>(
  rows: T[],
  columns: SortableColumn<T>[],
  options?: UseSortableTableOptions,
): UseSortableTableResult<T> {
  const validKeys = useMemo(
    () => columns.map((c) => c.key) as [string, ...string[]],
    [columns],
  );

  const [params, setParams] = useQueryStates(
    {
      sort: parseAsStringLiteral(validKeys),
      dir: parseAsStringEnum<SortDirection>(['asc', 'desc']),
    },
    { history: 'replace', scroll: false, shallow: true },
  );

  const defaultSortKey = options?.defaultSort?.key;
  const defaultSortDirection = options?.defaultSort?.direction;

  // Resolve sort state: URL params take precedence; fall back to defaultSort.
  // Primitive deps prevent recomputing when an inline defaultSort object is passed.
  const sort: SortState = useMemo(() => {
    if (params.sort !== null)
      return { key: params.sort, direction: params.dir ?? 'asc' };
    if (defaultSortKey !== undefined)
      return { key: defaultSortKey, direction: defaultSortDirection ?? 'asc' };
    return { key: null, direction: 'asc' };
  }, [params.sort, params.dir, defaultSortKey, defaultSortDirection]);

  const toggle = useCallback(
    (key: string) => {
      if (params.sort !== key) {
        // No explicit URL sort on this column → begin cycle at asc.
        void setParams({ sort: key as (typeof validKeys)[number], dir: 'asc' });
      } else if (params.dir !== 'desc') {
        // Explicitly sorted asc (or no dir param, which defaults to asc) → desc.
        void setParams({
          sort: key as (typeof validKeys)[number],
          dir: 'desc',
        });
      } else {
        // Explicitly sorted desc → clear (return to default order).
        void setParams({ sort: null, dir: null });
      }
    },
    [params.sort, params.dir, setParams],
  );

  const sortedRows = useMemo(() => {
    if (!sort.key) return rows;

    const column = columns.find((c) => c.key === sort.key);
    if (!column) return rows;

    return [...rows].sort((a, b) => {
      const valA = column.accessor(a);
      const valB = column.accessor(b);
      const cmp = compareValues(valA, valB);
      return sort.direction === 'desc' ? -cmp : cmp;
    });
  }, [rows, columns, sort.key, sort.direction]);

  const ariaSort = useCallback(
    (key: string): 'ascending' | 'descending' | 'none' => {
      if (sort.key !== key) return 'none';
      return sort.direction === 'asc' ? 'ascending' : 'descending';
    },
    [sort.key, sort.direction],
  );

  return { sortedRows, sort, toggle, ariaSort };
}
