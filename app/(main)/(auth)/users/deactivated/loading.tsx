import { Skeleton } from '@/components/ui/skeleton';

export default function DeactivatedUsersLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="mb-2 h-8 w-16" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      <Skeleton className="h-9 w-64" />

      <div className="rounded-lg border">
        <div className="border-b px-4 py-3">
          <div className="flex items-center gap-8">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-8 border-b px-4 py-4 last:border-b-0"
          >
            <div className="flex flex-col gap-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-44" />
            </div>
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
            <div className="ml-auto flex gap-2">
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
