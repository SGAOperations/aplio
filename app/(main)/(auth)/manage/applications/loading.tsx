import { ApplicationsResultsSkeleton } from '@/components/features/applications-results';
import { PageHeaderSkeleton } from '@/components/layouts/page-header';
import { DataTableToolbarSkeleton } from '@/components/ui/data-table-toolbar';

export default function ApplicationsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton titleWidth="w-36" />
      <DataTableToolbarSkeleton
        fields={['sm:w-48', 'sm:w-56', 'sm:w-44', 'sm:w-64']}
      />
      <ApplicationsResultsSkeleton />
    </div>
  );
}
