import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function GlobalQuestionsLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* PageHeader skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-8 w-28 shrink-0" />
      </div>

      {/* Table skeleton */}
      <Card className="gap-0 overflow-hidden p-0">
        <CardContent className="p-0">
          <div className="hidden md:block">
            <div className="flex h-10 items-center gap-8 border-b px-4">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b p-4 last:border-b-0"
              >
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-6 w-20" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-12" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col divide-y md:hidden">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-6 w-24" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-12" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
