'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

import type { SortDirection } from '@/lib/use-sortable-table';

import { TableHead } from '@/components/ui/table';

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  active: boolean;
  direction: SortDirection;
  ariaSort: 'ascending' | 'descending' | 'none';
  onToggle: () => void;
  className?: string;
}

export function SortableHeader({
  label,
  active,
  direction,
  ariaSort,
  onToggle,
  className,
}: SortableHeaderProps) {
  const isAsc = active && direction === 'asc';

  return (
    <TableHead aria-sort={ariaSort} className={className}>
      <button
        type="button"
        onClick={onToggle}
        className="hover:text-foreground flex items-center gap-1 font-medium transition-colors"
        aria-label={`Sort by ${label}${active ? (isAsc ? ', currently ascending' : ', currently descending') : ''}`}
      >
        {label}
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
