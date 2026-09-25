import { EmailFailureStripSkeleton } from '@/components/features/email-failure-strip';
import { EmailLogResultsSkeleton } from '@/components/features/email-log-results';
import { PageHeaderSkeleton } from '@/components/layouts/page-header';
import { DataTableToolbarSkeleton } from '@/components/ui/data-table-toolbar';
import { Skeleton } from '@/components/ui/skeleton';

export default function EmailsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton titleWidth="w-32" />
      <EmailFailureStripSkeleton />
      <DataTableToolbarSkeleton fields={['sm:w-44', 'sm:w-52', 'sm:w-64']} />
      <Skeleton className="h-5 w-full max-w-md" />
      <EmailLogResultsSkeleton />
    </div>
  );
}
