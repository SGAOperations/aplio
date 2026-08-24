import { AnswersCardSkeleton } from '@/components/features/application-answers-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function ApplicationDetailLoading() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        {/* Back link skeleton */}
        <Skeleton className="mb-2 h-7 w-40" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-5 w-20 rounded-md" />
            </div>
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-9 w-9" />
          </div>
        </div>
        <Skeleton className="mt-3 h-4 w-56" />
      </div>

      <div className="flex flex-col gap-4">
        <AnswersCardSkeleton titleWidth="w-32" />
        <AnswersCardSkeleton titleWidth="w-36" />
      </div>
    </div>
  );
}
