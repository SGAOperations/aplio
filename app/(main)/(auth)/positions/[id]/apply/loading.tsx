import { PageHeaderSkeleton } from '@/components/layouts/page-header';
import { Skeleton } from '@/components/ui/skeleton';

export default function ApplyLoading() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <PageHeaderSkeleton titleWidth="w-64" />
      </div>
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
