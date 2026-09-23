import {
  DATA_TABLE_DESKTOP_CLASS,
  DATA_TABLE_MOBILE_CLASS,
  DATA_TABLE_SHELL_CLASS,
  DATA_TABLE_STACK_CLASS,
} from '@/lib/data-table';
import { cn } from '@/lib/utils';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type DataTableSkeletonShape = 'text' | 'badge' | 'action' | 'checkbox';
type DataTableSkeletonMobileRole =
  | 'leading'
  | 'primary'
  | 'trailing'
  | 'line'
  | 'lineTrailing'
  | 'hidden';

export interface DataTableSkeletonColumn {
  head: string;
  cell?: string;
  subCell?: string;
  shape?: DataTableSkeletonShape;
  headClassName?: string;
  cellClassName?: string;
  mobile?: DataTableSkeletonMobileRole;
}

type DataTableSkeletonGap = 'gap-1' | 'gap-2' | 'gap-3';

interface DataTableSkeletonProps {
  columns: DataTableSkeletonColumn[];
  rows?: number;
  mobileRows?: number;
  hasReorderHandle?: boolean;
  // Vertical gap between stacked lines inside a mobile card — match the real table's mobile card.
  mobileGap?: DataTableSkeletonGap;
  // Gap between the leading column/handle and the card body, when either is present.
  mobileRowGap?: DataTableSkeletonGap;
}

function shapeSkeleton(
  shape: DataTableSkeletonShape | undefined,
  widthClass: string,
  { mobile = false }: { mobile?: boolean } = {},
) {
  const resolved: DataTableSkeletonShape = shape ?? 'text';
  switch (resolved) {
    case 'checkbox':
      return <Skeleton className="size-4 shrink-0 rounded-sm" />;
    case 'badge':
      return <Skeleton className={cn('h-5.5 rounded-md', widthClass)} />;
    case 'action':
      return (
        <Skeleton
          className={cn(mobile ? 'h-11' : 'h-8', 'rounded-md', widthClass)}
        />
      );
    case 'text':
      return <Skeleton className={cn('h-4', widthClass)} />;
    default: {
      const exhaustiveCheck: never = resolved;
      return exhaustiveCheck;
    }
  }
}

// Resolves each column's mobile role: explicit wins; otherwise the first
// column defaults to `primary` and the first `badge` column to `trailing`.
function resolveMobileRoles(
  columns: DataTableSkeletonColumn[],
): DataTableSkeletonMobileRole[] {
  let trailingAssigned = false;
  return columns.map((column, index) => {
    if (column.mobile) {
      if (column.mobile === 'trailing') trailingAssigned = true;
      return column.mobile;
    }
    if (index === 0) return 'primary';
    if (column.shape === 'badge' && !trailingAssigned) {
      trailingAssigned = true;
      return 'trailing';
    }
    return 'line';
  });
}

function DataTableSkeletonMobileRow({
  columns,
  roles,
  hasReorderHandle,
  mobileGap,
  mobileRowGap,
}: {
  columns: DataTableSkeletonColumn[];
  roles: DataTableSkeletonMobileRole[];
  hasReorderHandle: boolean;
  mobileGap: DataTableSkeletonGap;
  mobileRowGap: DataTableSkeletonGap;
}) {
  const leading = columns.filter((_, i) => roles[i] === 'leading');
  const primaryColumn = columns.find((_, i) => roles[i] === 'primary');
  const trailingColumn = columns.find((_, i) => roles[i] === 'trailing');
  const lineItems: {
    main: DataTableSkeletonColumn;
    trailing?: DataTableSkeletonColumn;
  }[] = [];
  columns.forEach((column, i) => {
    if (roles[i] === 'line') lineItems.push({ main: column });
    else if (roles[i] === 'lineTrailing') {
      const last = lineItems.at(-1);
      if (last) last.trailing = column;
      else lineItems.push({ main: column });
    }
  });

  const body = (
    <div className={cn('flex min-w-0 flex-1 flex-col', mobileGap)}>
      {(primaryColumn || trailingColumn) && (
        <div className="flex items-center justify-between gap-2">
          {primaryColumn ? (
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {shapeSkeleton(
                primaryColumn.shape,
                primaryColumn.cell ?? primaryColumn.head,
              )}
              {primaryColumn.subCell && (
                <Skeleton className={cn('h-3', primaryColumn.subCell)} />
              )}
            </div>
          ) : (
            <div />
          )}
          {trailingColumn &&
            shapeSkeleton(
              trailingColumn.shape,
              trailingColumn.cell ?? trailingColumn.head,
              { mobile: true },
            )}
        </div>
      )}
      {lineItems.map(({ main, trailing }, i) =>
        trailing ? (
          <div key={i} className="flex items-center justify-between gap-2">
            {shapeSkeleton(main.shape, main.cell ?? main.head)}
            {shapeSkeleton(trailing.shape, trailing.cell ?? trailing.head, {
              mobile: true,
            })}
          </div>
        ) : (
          <div key={i}>{shapeSkeleton(main.shape, main.cell ?? main.head)}</div>
        ),
      )}
    </div>
  );

  if (!hasReorderHandle && leading.length === 0)
    return <div className={cn('flex flex-col p-4', mobileGap)}>{body}</div>;

  return (
    <div className={cn('flex items-start p-4', mobileRowGap)}>
      {hasReorderHandle && (
        <Skeleton className="ml-2 size-11 shrink-0 rounded-md" />
      )}
      {leading.map((column, i) => (
        <div key={i} className="mt-0.5 shrink-0">
          {shapeSkeleton(column.shape, column.cell ?? column.head)}
        </div>
      ))}
      {body}
    </div>
  );
}

export function DataTableSkeleton({
  columns,
  rows = 5,
  mobileRows = 3,
  hasReorderHandle = false,
  mobileGap = 'gap-2',
  mobileRowGap = 'gap-2',
}: DataTableSkeletonProps) {
  const mobileRoles = resolveMobileRoles(columns);

  return (
    <div className={DATA_TABLE_STACK_CLASS}>
      <Card className={DATA_TABLE_SHELL_CLASS}>
        <div className={DATA_TABLE_DESKTOP_CLASS}>
          <Table>
            <TableHeader>
              <TableRow>
                {hasReorderHandle && (
                  <TableHead className="w-8 px-2">
                    <span className="sr-only">Reorder</span>
                  </TableHead>
                )}
                {columns.map((column, i) => (
                  <TableHead key={i} className={column.headClassName}>
                    <Skeleton className={cn('h-4', column.head)} />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: rows }).map((_, rowIndex) => (
                <TableRow key={rowIndex}>
                  {hasReorderHandle && (
                    <TableCell className="px-2">
                      <Skeleton className="size-8 rounded-md" />
                    </TableCell>
                  )}
                  {columns.map((column, i) => (
                    <TableCell key={i} className={column.cellClassName}>
                      {column.subCell ? (
                        <div className="flex flex-col gap-1">
                          <Skeleton
                            className={cn('h-4', column.cell ?? column.head)}
                          />
                          <Skeleton className={cn('h-3', column.subCell)} />
                        </div>
                      ) : (
                        shapeSkeleton(column.shape, column.cell ?? column.head)
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className={DATA_TABLE_MOBILE_CLASS}>
          {Array.from({ length: mobileRows }).map((_, rowIndex) => (
            <DataTableSkeletonMobileRow
              key={rowIndex}
              columns={columns}
              roles={mobileRoles}
              hasReorderHandle={hasReorderHandle}
              mobileGap={mobileGap}
              mobileRowGap={mobileRowGap}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
