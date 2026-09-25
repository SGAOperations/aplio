import { PageHeaderSkeleton } from '@/components/layouts/page-header';

export default function HomeLoading() {
  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeaderSkeleton />
    </div>
  );
}
