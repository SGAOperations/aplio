import type { ReactNode } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: string | null;
  direction: SortDirection;
}

export type SortValue = string | number | Date;
// A tuple element may itself be missing — e.g. a name/email fallback pair
// where only one is set — and still sort deterministically (see compareValues).
type SortTupleValue = SortValue | null | undefined;

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  // Presence makes the column sortable. An array is compared left-to-right (tuple sort).
  sortAccessor?: (row: T) => SortValue | SortTupleValue[] | null | undefined;
  // Feeds filterRows's free-text `query` (case-insensitive substring).
  searchValue?: (row: T) => string | string[] | null;
  // Feeds filterRows's per-column `filters` (exact match).
  filterValue?: (row: T) => string | string[] | null;
  headClassName?: string;
  cellClassName?: string;
}

function compareScalar(a: SortValue, b: SortValue): number {
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

// Tuples compare index-by-index; a missing element sorts last; equal
// prefix → shorter array first.
export function compareValues(
  a: SortValue | SortTupleValue[],
  b: SortValue | SortTupleValue[],
): number {
  const arrA = Array.isArray(a) ? a : [a];
  const arrB = Array.isArray(b) ? b : [b];

  for (let i = 0; i < Math.min(arrA.length, arrB.length); i++) {
    const valA = arrA[i];
    const valB = arrB[i];
    if (valA == null && valB == null) continue;
    if (valA == null) return 1;
    if (valB == null) return -1;

    const cmp = compareScalar(valA, valB);
    if (cmp !== 0) return cmp;
  }

  return arrA.length - arrB.length;
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
        if (!column.searchValue) return false;
        const value = column.searchValue(row);
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
