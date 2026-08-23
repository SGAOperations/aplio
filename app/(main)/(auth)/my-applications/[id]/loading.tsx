import { AnswersCardSkeleton } from '@/components/features/application-answers-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function MyApplicationDetailLoading() {
  return (
    <div className="mx-auto max-w-5xl">
      {/* Header row: position info skeleton on left, Progress panel skeleton on right */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-1 h-4 w-56" />
        </div>

        <div className="lg:w-72 lg:shrink-0">
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

      {/* Answers: full-width below the header */}
      <div className="flex flex-col gap-4">
        <AnswersCardSkeleton titleWidth="w-40" />
        <AnswersCardSkeleton titleWidth="w-52" />
      </div>
    </div>
  );
}
