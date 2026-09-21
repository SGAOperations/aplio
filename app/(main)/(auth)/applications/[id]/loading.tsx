import { AnswersCardSkeleton } from '@/components/features/application-answers-skeleton';
import { PageHeaderSkeleton } from '@/components/layouts/page-header';
import { Skeleton } from '@/components/ui/skeleton';

export default function MyApplicationDetailLoading() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <PageHeaderSkeleton
          titleWidth="w-48"
          hasBack
          hasAdornment
          actionSize="sm"
          actions={['w-32', 'w-9']}
        />
        <Skeleton className="mt-1 h-5 w-56" />
      </div>

      <div className="flex flex-col gap-4">
        <AnswersCardSkeleton titleWidth="w-40" />
        <AnswersCardSkeleton titleWidth="w-52" />
      </div>
    </div>
  );
}
