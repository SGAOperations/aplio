import { Skeleton } from '@/components/ui/skeleton';

const ANSWER_ROW_CLASS =
  'px-4 py-3 sm:grid sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:gap-4';

export function AnswersCardSkeleton({ titleWidth }: { titleWidth: string }) {
  return (
    <div className="gap-0 overflow-hidden rounded-xl border p-0 shadow-sm">
      <div className="border-b p-4">
        <Skeleton className={`h-5 ${titleWidth}`} />
      </div>
      <div className="divide-y">
        <div className={ANSWER_ROW_CLASS}>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-full" />
        </div>
        <div className={ANSWER_ROW_CLASS}>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className={ANSWER_ROW_CLASS}>
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-16 w-full max-w-prose" />
        </div>
      </div>
    </div>
  );
}
