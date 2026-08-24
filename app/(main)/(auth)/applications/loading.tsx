import { ApplicationsTableSkeleton } from '@/components/features/applications-table-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function ApplicationsLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header skeleton */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Toolbar skeleton — Position Select + Applicant Select + Status Select + Search Input */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-9 w-48" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-9 w-56" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-9 w-44" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-9 w-56" />
        </div>
      </div>

      <ApplicationsTableSkeleton />
    </div>
  );
}
