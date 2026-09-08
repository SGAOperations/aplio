import { formatPaginationSummary, getPaginationRange } from '@/lib/utils';

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

interface TablePaginationProps {
  buildHref: (page: number) => string;
  currentPage: number;
  totalPages: number;
  total: number;
  rangeStart: number;
  rangeEnd: number;
  isFiltered: boolean;
  noun?: string;
}

export function TablePagination({
  buildHref,
  currentPage,
  totalPages,
  total,
  rangeStart,
  rangeEnd,
  isFiltered,
  noun = 'application',
}: TablePaginationProps) {
  if (total === 0) return null;

  const summary = formatPaginationSummary({
    rangeStart,
    rangeEnd,
    total,
    noun,
    isFiltered,
  });

  if (totalPages === 1)
    return (
      <p aria-live="polite" className="text-muted-foreground text-sm">
        {summary}
      </p>
    );

  const range = getPaginationRange(currentPage, totalPages);
  const isFirst = currentPage <= 1;
  const isLast = currentPage >= totalPages;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p aria-live="polite" className="text-muted-foreground text-sm">
        {summary}
      </p>

      <Pagination className="mx-0 w-auto justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href={isFirst ? undefined : buildHref(currentPage - 1)}
              disabled={isFirst}
            />
          </PaginationItem>

          <PaginationItem className="sm:hidden">
            <span className="text-muted-foreground px-2 text-sm">
              Page {currentPage} of {totalPages}
            </span>
          </PaginationItem>

          {range.map((p, i) =>
            p === 'ellipsis' ? (
              <PaginationItem
                key={`ellipsis-${i}`}
                className="hidden sm:list-item"
              >
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={p} className="hidden sm:list-item">
                <PaginationLink
                  href={buildHref(p)}
                  isActive={p === currentPage}
                  aria-label={`Go to page ${p}`}
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            ),
          )}

          <PaginationItem>
            <PaginationNext
              href={isLast ? undefined : buildHref(currentPage + 1)}
              disabled={isLast}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
