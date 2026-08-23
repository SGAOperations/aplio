import { SectionCardSkeleton } from '@/components/ui/section-card';
import { Skeleton } from '@/components/ui/skeleton';

export default function HomeLoading() {
  return (
    <div className="flex w-full flex-col gap-6">
      {/* Heading */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      <SectionCardSkeleton rowShape="badge-meta" hasSubtitle />
      <SectionCardSkeleton rowShape="stacked-action" />
    </div>
  );
}
