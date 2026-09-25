import { AnswersCardSkeleton } from '@/components/features/application-answers-skeleton';
import { PageHeaderSkeleton } from '@/components/layouts/page-header';
import { SectionCardSkeleton } from '@/components/ui/section-card';
import { Skeleton } from '@/components/ui/skeleton';

export default function ApplicationDetailLoading() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <PageHeaderSkeleton
          titleWidth="w-40"
          hasBack
          hasAdornment
          actionSize="sm"
          actions={['w-40', 'w-9']}
        />
        <Skeleton className="mt-1 h-5 w-56" />
      </div>

      <div className="flex flex-col gap-4">
        <SectionCardSkeleton
          rowShape="badge-meta"
          hasSubtitle
          hasLink={false}
        />
        <AnswersCardSkeleton titleWidth="w-32" />
        <AnswersCardSkeleton titleWidth="w-36" />
        <SectionCardSkeleton
          rowShape="badge-stacked"
          hasSubtitle
          hasLink={false}
          rows={2}
        />
      </div>
    </div>
  );
}
