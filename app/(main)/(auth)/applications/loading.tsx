import { PageHeaderSkeleton } from '@/components/layouts/page-header';
import {
  DataTableSkeleton,
  type DataTableSkeletonColumn,
} from '@/components/ui/data-table-skeleton';

const COLUMNS: DataTableSkeletonColumn[] = [
  { head: 'w-20', cell: 'w-40', mobile: 'primary' },
  { head: 'w-16', shape: 'badge', mobile: 'trailing' },
  { head: 'w-24', mobile: 'line' },
  { head: 'w-16', shape: 'action', cell: 'w-20', mobile: 'lineTrailing' },
];

export default function MyApplicationsLoading() {
  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeaderSkeleton titleWidth="w-48" />
      <DataTableSkeleton columns={COLUMNS} />
    </div>
  );
}
