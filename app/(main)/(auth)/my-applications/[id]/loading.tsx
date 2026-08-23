import { AnswersCardSkeleton } from '@/components/features/application-answers-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function MyApplicationDetailLoading() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        {/* Back link skeleton */}
        <Skeleton className="mb-2 h-7 w-48" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-5 w-20 rounded-md" />
            </div>
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
        <Skeleton className="mt-3 h-4 w-56" />
      </div>

      <div className="flex flex-col gap-4">
        <AnswersCardSkeleton titleWidth="w-40" />
        <AnswersCardSkeleton titleWidth="w-52" />
      </div>
    </div>
  );
}
