import { PageHeaderSkeleton } from '@/components/layouts/page-header';
import {
  DataTableSkeleton,
  type DataTableSkeletonColumn,
} from '@/components/ui/data-table-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

const COLUMNS: DataTableSkeletonColumn[] = [
  { head: 'w-12', cell: 'w-8', headClassName: 'w-12 px-2' },
  { head: 'w-24', cell: 'w-56' },
  { head: 'w-24', headClassName: 'w-36', shape: 'badge' },
  { head: 'w-24', cell: 'w-24' },
  { head: 'w-20', headClassName: 'w-28', shape: 'badge' },
  { head: 'w-24', headClassName: 'w-32', shape: 'action', cell: 'w-20' },
];

// Mirrors GlobalQuestionsTable's mobileCard.
function mobileCard() {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="size-8 rounded-md" />
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-5.5 w-24 rounded-md" />
          <Skeleton className="h-5.5 w-20 rounded-md" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="size-11 rounded-md" />
          <Skeleton className="size-11 rounded-md" />
        </div>
      </div>
    </>
  );
}

export default function GlobalQuestionsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton actions={['w-32']} actionSize="sm" />
      <DataTableSkeleton
        columns={COLUMNS}
        mobileGap="gap-2"
        mobileCard={mobileCard}
      />
    </div>
  );
}
