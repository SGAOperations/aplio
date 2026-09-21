import { PageHeaderSkeleton } from '@/components/layouts/page-header';
import {
  DataTableSkeleton,
  type DataTableSkeletonColumn,
} from '@/components/ui/data-table-skeleton';
import { DataTableToolbarSkeleton } from '@/components/ui/data-table-toolbar';

const COLUMNS: DataTableSkeletonColumn[] = [
  { head: 'w-24', cell: 'w-32', subCell: 'w-44', mobile: 'primary' },
  { head: 'w-16', shape: 'badge', mobile: 'trailing' },
  { head: 'w-20', mobile: 'hidden' },
  { head: 'w-8', mobile: 'hidden' },
  { head: 'w-20', shape: 'badge', mobile: 'line' },
  {
    head: 'w-24',
    shape: 'action',
    headClassName: 'text-right',
    mobile: 'lineTrailing',
  },
];

export default function UsersLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton titleWidth="w-24" actions={['w-32']} />
      <DataTableToolbarSkeleton
        fields={['sm:w-48', 'sm:w-48', 'sm:w-64']}
        hasTrailingCount
      />
      <DataTableSkeleton columns={COLUMNS} />
    </div>
  );
}
