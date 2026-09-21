import { PositionCardSkeleton } from '@/components/features/position-card';
import { PageHeaderSkeleton } from '@/components/layouts/page-header';
import { Skeleton } from '@/components/ui/skeleton';

function PositionGroupSkeleton({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Skeleton className="size-4 rounded" />
        <Skeleton className="h-7 w-24" />
      </div>
      <div className="flex flex-col gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <PositionCardSkeleton key={i} hasStats actions={3} />
        ))}
      </div>
    </div>
  );
}

export default function ManagePositionsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton actions={['w-36']} />
      <div className="flex flex-col gap-6">
        <PositionGroupSkeleton count={2} />
        <PositionGroupSkeleton count={1} />
      </div>
    </div>
  );
}
