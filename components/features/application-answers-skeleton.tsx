import { Skeleton } from '@/components/ui/skeleton';

export function AnswersCardSkeleton({ titleWidth }: { titleWidth: string }) {
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
