'use client';

import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { parseAsStringEnum, parseAsStringLiteral, useQueryStates } from 'nuqs';

import {
  type DataTableColumn,
  type SortDirection,
  type SortState,
  compareValues,
} from '@/lib/data-table';
import { cn } from '@/lib/utils';

import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface DataTableProps<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  getRowKey: (row: T) => string;
  mobileCard: (row: T) => ReactNode;
  // Shown in place of the whole table when `rows` is empty and no filter is active.
  emptyState?: ReactNode;
  noMatchMessage?: string;
  defaultSort?: SortState;
  isRowSelected?: (row: T) => boolean;
  caption: string;
  // Controlled sort mode: pass both to opt the caller's own state/URL contract in.
  sort?: SortState;
  onSortToggle?: (key: string) => void;
}

function sortLabel(header: ReactNode, key: string): string {
  return typeof header === 'string' ? header : key;
}

function SortableColumnHead({
  header,
  columnKey,
  active,
  direction,
  ariaSort,
  onToggle,
  className,
}: {
  header: ReactNode;
  columnKey: string;
  active: boolean;
  direction: SortDirection;
  ariaSort: 'ascending' | 'descending' | 'none';
  onToggle: () => void;
  className?: string;
}) {
  const isAsc = active && direction === 'asc';
  const label = sortLabel(header, columnKey);

  return (
    <TableHead aria-sort={ariaSort} className={className}>
      <button
        type="button"
        onClick={onToggle}
        className="hover:text-foreground flex items-center gap-1 font-medium transition-colors"
        aria-label={`Sort by ${label}${active ? (isAsc ? ', currently ascending' : ', currently descending') : ''}`}
      >
        {header}
        {active ? (
          isAsc ? (
            <ArrowUp
              className="text-foreground h-3.5 w-3.5"
              aria-hidden="true"
            />
          ) : (
            <ArrowDown
              className="text-foreground h-3.5 w-3.5"
              aria-hidden="true"
            />
          )
        ) : (
          <ArrowUpDown
            className="text-muted-foreground h-3.5 w-3.5"
            aria-hidden="true"
          />
        )}
      </button>
    </TableHead>
  );
}

export function DataTable<T>({
  rows,
  columns,
  getRowKey,
  mobileCard,
  emptyState,
  noMatchMessage = 'No results match your filters.',
  defaultSort,
  isRowSelected,
  caption,
  sort: controlledSort,
  onSortToggle,
}: DataTableProps<T>) {
  const controlled = onSortToggle !== undefined;

  const sortableKeys = useMemo(() => {
    const keys = columns.filter((c) => c.sortAccessor).map((c) => c.key);
    return (keys.length > 0 ? keys : ['__none__']) as [string, ...string[]];
  }, [columns]);

  const [params, setParams] = useQueryStates(
    {
      sort: parseAsStringLiteral(sortableKeys),
      dir: parseAsStringEnum<SortDirection>(['asc', 'desc']),
    },
    { history: 'replace', scroll: false, shallow: true },
  );

  const uncontrolledSort: SortState = useMemo(() => {
    if (params.sort !== null)
      return { key: params.sort, direction: params.dir ?? 'asc' };
    if (defaultSort) return defaultSort;
    return { key: null, direction: 'asc' };
  }, [params.sort, params.dir, defaultSort]);

  const sort = controlled
    ? (controlledSort ?? { key: null, direction: 'asc' as const })
    : uncontrolledSort;

  const toggle = useCallback(
    (key: string) => {
      if (controlled) {
        onSortToggle?.(key);
        return;
      }
      if (params.sort !== key) void setParams({ sort: key, dir: 'asc' });
      else if (params.dir !== 'desc') void setParams({ sort: key, dir: 'desc' });
      else void setParams({ sort: null, dir: null });
    },
    [controlled, onSortToggle, params.sort, params.dir, setParams],
  );

  const sortedRows = useMemo(() => {
    if (controlled || !sort.key) return rows;
    const column = columns.find((c) => c.key === sort.key && c.sortAccessor);
    if (!column?.sortAccessor) return rows;

    return [...rows].sort((a, b) => {
      const valA = column.sortAccessor?.(a);
      const valB = column.sortAccessor?.(b);

      if (valA == null && valB == null) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;

      const cmp = compareValues(valA, valB);
      return sort.direction === 'desc' ? -cmp : cmp;
    });
  }, [controlled, rows, columns, sort.key, sort.direction]);

  function ariaSort(key: string): 'ascending' | 'descending' | 'none' {
    if (sort.key !== key) return 'none';
    return sort.direction === 'asc' ? 'ascending' : 'descending';
  }

  if (rows.length === 0 && emptyState) return <>{emptyState}</>;

  return (
    // overflow-hidden clips the header hover highlight to the card's rounded corners
    <Card className="gap-0 overflow-hidden p-0">
      <div className="hidden md:block">
        <Table>
          <TableCaption className="sr-only">{caption}</TableCaption>
          <TableHeader>
            <TableRow>
              {columns.map((column) =>
                column.sortAccessor ? (
                  <SortableColumnHead
                    key={column.key}
                    header={column.header}
                    columnKey={column.key}
                    active={sort.key === column.key}
                    direction={sort.direction}
                    ariaSort={ariaSort(column.key)}
                    onToggle={() => toggle(column.key)}
                    className={column.headClassName}
                  />
                ) : (
                  <TableHead key={column.key} className={column.headClassName}>
                    {column.header}
                  </TableHead>
                ),
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-muted-foreground text-center"
                >
                  {noMatchMessage}
                </TableCell>
              </TableRow>
            ) : (
              sortedRows.map((row) => (
                <TableRow
                  key={getRowKey(row)}
                  data-state={isRowSelected?.(row) ? 'selected' : undefined}
                >
                  {columns.map((column) => (
                    <TableCell key={column.key} className={column.cellClassName}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile stacked cards — sort order from sortedRows reflects active sort */}
      <div className="flex flex-col divide-y md:hidden">
        {sortedRows.length === 0 ? (
          <p className="text-muted-foreground p-4 text-center text-sm">
            {noMatchMessage}
          </p>
        ) : (
          sortedRows.map((row) => (
            <div key={getRowKey(row)}>{mobileCard(row)}</div>
          ))
        )}
      </div>
    </Card>
  );
}

export function DataTableRowActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap gap-2 [&>*]:min-h-11 md:[&>*]:min-h-0', className)}>
      {children}
    </div>
  );
}
