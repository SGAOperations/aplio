import { Skeleton } from '@/components/ui/skeleton';

export default function PositionDetailLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Skeleton className="mb-4 h-4 w-28" />
        <div className="mt-2 flex items-center gap-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
      <div className="max-w-2xl space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
      <div className="max-w-2xl">
        <Skeleton className="mb-3 h-5 w-40" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-56" />
          ))}
        </div>
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
    </div>
  );
}
