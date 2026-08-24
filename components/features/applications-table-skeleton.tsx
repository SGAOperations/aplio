import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function ApplicationsTableSkeleton() {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <CardContent className="p-0">
        <div className="hidden md:block">
          <div className="flex h-10 items-center gap-4 border-b px-4">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b p-4 last:border-b-0"
            >
              <Skeleton className="h-4 w-4 shrink-0" />
              <div className="flex flex-1 flex-col gap-1">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>

        <div className="flex flex-col divide-y md:hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3 p-4">
              <Skeleton className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
