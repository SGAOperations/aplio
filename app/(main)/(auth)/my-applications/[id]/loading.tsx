import { Skeleton } from '@/components/ui/skeleton';

function AnswersCardSkeleton({ titleWidth }: { titleWidth: string }) {
  return (
    <div className="gap-0 overflow-hidden rounded-xl border p-0 shadow-sm">
      <div className="border-b p-4">
        <Skeleton className={`h-5 ${titleWidth}`} />
      </div>
      <div className="divide-y">
        <div className="px-4 py-3 sm:grid sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="px-4 py-3 sm:grid sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="flex flex-col gap-1.5 px-4 py-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-16 w-full max-w-prose" />
        </div>
      </div>
    </div>
  );
}

export default function MyApplicationDetailLoading() {
  return (
    <div className="mx-auto max-w-5xl">
      {/* PageHeader skeleton */}
      <div className="mb-4 flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-1 h-4 w-56" />
      </div>

      {/* Two-column layout matching the page */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: answers */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <AnswersCardSkeleton titleWidth="w-40" />
          <AnswersCardSkeleton titleWidth="w-52" />
        </div>

        {/* Right: Progress panel */}
        <div className="order-first lg:order-none">
          <div className="gap-0 overflow-hidden rounded-xl border p-0 shadow-sm">
            <div className="border-b p-4">
              <Skeleton className="h-5 w-20" />
            </div>
            <div className="flex flex-col gap-3 p-4">
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
