import { Skeleton } from '@/components/ui/skeleton';

export default function MyApplicationDetailLoading() {
  return (
    <div className="mx-auto max-w-5xl">
      {/* PageHeader skeleton */}
      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Two-column layout matching the page */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: answers */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="rounded-xl border p-4 shadow-sm">
            <Skeleton className="mb-3 h-5 w-40" />
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

          <div className="rounded-xl border p-4 shadow-sm">
            <Skeleton className="mb-1 h-5 w-44" />
            <Skeleton className="mb-3 h-3 w-28" />
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

        {/* Right: Status panel */}
        <div className="order-first lg:order-none">
          <div className="rounded-xl border p-4 shadow-sm">
            <Skeleton className="mb-4 h-5 w-12" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-9 w-32" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
