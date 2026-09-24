import { PageHeaderSkeleton } from '@/components/layouts/page-header';
import {
  DataTableSkeleton,
  type DataTableSkeletonColumn,
} from '@/components/ui/data-table-skeleton';

const COLUMNS: DataTableSkeletonColumn[] = [
  { head: 'w-12', cell: 'w-8', headClassName: 'w-12 px-2', mobile: 'line' },
  { head: 'w-24', cell: 'w-56', mobile: 'primary' },
  { head: 'w-24', headClassName: 'w-36', shape: 'badge', mobile: 'trailing' },
  { head: 'w-24', cell: 'w-24', mobile: 'hidden' },
  {
    head: 'w-20',
    headClassName: 'w-28',
    shape: 'badge',
    mobile: 'lineTrailing',
  },
  {
    head: 'w-24',
    headClassName: 'w-32',
    shape: 'action',
    cell: 'w-20',
    mobile: 'line',
  },
];

export default function GlobalQuestionsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton actions={['w-32']} actionSize="sm" />
      <DataTableSkeleton
        columns={COLUMNS}
        hasReorderHandle
        mobileGap="gap-3"
        mobileRowGap="gap-0"
      />
    </div>
  );
}
