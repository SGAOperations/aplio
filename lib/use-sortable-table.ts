'use client';

import { useCallback, useMemo } from 'react';

import { parseAsStringEnum, parseAsStringLiteral, useQueryStates } from 'nuqs';

export type SortDirection = 'asc' | 'desc';

// `key` is the URL token; `accessor` pulls the comparable value from a row.
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
  a: string | number | Date,
  b: string | number | Date,
): number {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string')
    return a.localeCompare(b, undefined, {
      sensitivity: 'base',
      numeric: true,
    });

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
  const validKeys = useMemo(() => {
    // The cast below assumes non-empty; fail loudly rather than miscast.
    if (columns.length === 0)
      throw new Error('useSortableTable requires at least one column');
    return columns.map((c) => c.key) as [string, ...string[]];
  }, [columns]);

  const [params, setParams] = useQueryStates(
    {
      sort: parseAsStringLiteral(validKeys),
      dir: parseAsStringEnum<SortDirection>(['asc', 'desc']),
    },
    { history: 'replace', scroll: false, shallow: true },
  );

  const defaultSortKey = options?.defaultSort?.key;
  const defaultSortDirection = options?.defaultSort?.direction;

  // Primitive deps, so an inline defaultSort object doesn't recompute every render.
  const sort: SortState = useMemo(() => {
    if (params.sort !== null)
      return { key: params.sort, direction: params.dir ?? 'asc' };
    if (defaultSortKey !== undefined)
      return { key: defaultSortKey, direction: defaultSortDirection ?? 'asc' };
    return { key: null, direction: 'asc' };
  }, [params.sort, params.dir, defaultSortKey, defaultSortDirection]);

  // Cycles asc → desc → cleared on repeated clicks.
  const toggle = useCallback(
    (key: string) => {
      if (params.sort !== key) {
        void setParams({ sort: key, dir: 'asc' });
      } else if (params.dir !== 'desc') {
        void setParams({ sort: key, dir: 'desc' });
      } else {
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

      // Nulls sort last either way — checked before the desc negation flips it.
      if (valA == null && valB == null) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;

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
