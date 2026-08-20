import type { ReactNode } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: string | null;
  direction: SortDirection;
}

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  // Presence makes the column sortable.
  sortAccessor?: (row: T) => string | number | Date | null | undefined;
  // Feeds filterRows — search (any column) and per-column filters.
  filterValue?: (row: T) => string | string[] | null;
  headClassName?: string;
  cellClassName?: string;
}

export function compareValues(
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

export interface DataTableFilter {
  key: string;
  value: string;
}

export interface FilterRowsOptions {
  query?: string;
  filters?: DataTableFilter[];
}

/** Pure, server-safe: case-insensitive substring for `query`, exact match for `filters`. */
export function filterRows<T>(
  rows: T[],
  columns: DataTableColumn<T>[],
  { query, filters = [] }: FilterRowsOptions,
): T[] {
  const q = query?.trim().toLowerCase();
  if (!q && filters.length === 0) return rows;

  return rows.filter((row) => {
    if (q) {
      const matches = columns.some((column) => {
        if (!column.filterValue) return false;
        const value = column.filterValue(row);
        if (value == null) return false;
        const values = Array.isArray(value) ? value : [value];
        return values.some((v) => v.toLowerCase().includes(q));
      });
      if (!matches) return false;
    }

    for (const filter of filters) {
      const column = columns.find((c) => c.key === filter.key);
      if (!column?.filterValue) continue;
      const value = column.filterValue(row);
      const values =
        value == null ? [] : Array.isArray(value) ? value : [value];
      if (!values.includes(filter.value)) return false;
    }

    return true;
  });
}
