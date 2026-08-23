import { AnswersCardSkeleton } from '@/components/features/application-answers-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function ApplicationDetailLoading() {
  return (
    <div className="mx-auto max-w-5xl">
      {/* PageHeader skeleton */}
      <div className="mb-4 flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="mt-1 h-4 w-56" />
      </div>

      {/* Two-column layout matching the page */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: answers */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <AnswersCardSkeleton titleWidth="w-32" />
          <AnswersCardSkeleton titleWidth="w-36" />
        </div>

        {/* Right: Review panel */}
        <div className="order-first lg:order-none">
          <div className="gap-0 overflow-hidden rounded-xl border p-0 shadow-sm">
            <div className="border-b p-4">
              <Skeleton className="h-5 w-16" />
            </div>
            <div className="flex flex-col gap-3 p-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
