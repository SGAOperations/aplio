import { PositionCardSkeleton } from '@/components/features/position-card';
import { PageHeaderSkeleton } from '@/components/layouts/page-header';
import { Skeleton } from '@/components/ui/skeleton';

export default function PositionsLoading() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeaderSkeleton titleWidth="w-40" />
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-7 w-40" />
        </div>
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <PositionCardSkeleton key={i} actions={2} />
          ))}
        </div>
      </div>
    </div>
  );
}
