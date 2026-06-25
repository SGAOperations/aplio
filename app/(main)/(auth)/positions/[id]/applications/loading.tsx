import { Skeleton } from '@/components/ui/skeleton';

export default function PositionApplicationsLoading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      {/* PageHeader skeleton: back link + title + description */}
      <div className="flex flex-col gap-1">
        <Skeleton className="mb-1 h-7 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-28" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border">
        <div className="border-b p-4">
          <div className="flex gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b p-4 last:border-b-0"
          >
            <div className="flex flex-1 flex-col gap-1">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-44" />
          </div>
        ))}
      </div>
    </div>
  );
}
