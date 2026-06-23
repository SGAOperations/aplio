import { Skeleton } from '@/components/ui/skeleton';

export default function EditPositionLoading() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-24" />
      </div>

      <div className="flex flex-col gap-4">
        {/* Tab bar skeleton */}
        <div className="flex gap-1 rounded-lg border p-1">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 flex-1" />
        </div>

        {/* Tab content skeleton — matches the Details form */}
        <div className="mt-2 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
    </div>
  );
}
