import { Skeleton } from '@/components/ui/skeleton';

export default function ApplicationDetailLoading() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      {/* Header skeleton */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Status card skeleton */}
      <div className="rounded-xl border p-6 shadow-sm">
        <Skeleton className="mb-4 h-5 w-12" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-9 w-52" />
        </div>
      </div>

      {/* Profile answers card skeleton */}
      <div className="rounded-xl border p-6 shadow-sm">
        <Skeleton className="mb-4 h-5 w-32" />
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-full" />
          </div>
          <div className="flex flex-col gap-1">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="flex flex-col gap-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </div>

      {/* Position answers card skeleton */}
      <div className="rounded-xl border p-6 shadow-sm">
        <Skeleton className="mb-1 h-5 w-36" />
        <Skeleton className="mb-4 h-3 w-28" />
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-16 w-full" />
          </div>
          <div className="flex flex-col gap-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </div>
    </div>
  );
}
