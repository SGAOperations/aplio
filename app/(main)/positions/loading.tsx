import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function PositionsLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex flex-col gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="gap-0 p-0">
            <CardHeader className="p-0">
              <div className="flex w-full items-center justify-between p-6">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="size-5 rounded" />
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
