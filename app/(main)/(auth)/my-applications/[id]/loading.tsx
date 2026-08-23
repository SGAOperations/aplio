import { AnswersCardSkeleton } from '@/components/features/application-answers-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function MyApplicationDetailLoading() {
  return (
    <div className="mx-auto max-w-5xl">
      {/* Grid so the panel skeleton's row-span keeps a full-height sticky container */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-x-6">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-1 h-4 w-56" />
          </div>
        </div>

        <div className="mt-4 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:max-h-[calc(100svh-3rem)] lg:overflow-y-auto">
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

        <div className="mt-6 flex flex-col gap-4 lg:col-start-1 lg:row-start-2">
          <AnswersCardSkeleton titleWidth="w-40" />
          <AnswersCardSkeleton titleWidth="w-52" />
        </div>
      </div>
    </div>
  );
}
