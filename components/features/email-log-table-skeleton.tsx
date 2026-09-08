import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function EmailLogTableSkeleton() {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <CardContent className="p-0">
        <div className="hidden md:block">
          <div className="flex h-10 items-center gap-4 border-b px-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-4 w-40" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b p-4 last:border-b-0"
            >
              <div className="flex flex-1 flex-col gap-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>

        <div className="flex flex-col divide-y md:hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-20" />
              </div>
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
