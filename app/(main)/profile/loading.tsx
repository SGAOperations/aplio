import { Skeleton } from '@/components/ui/skeleton';

export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-col gap-6">
        {/* PageHeader skeleton */}
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Name card skeleton — shown while the gate check is pending */}
        <div className="rounded-lg border p-6">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-72" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-9 w-24" />
          </div>
        </div>

        {/* Edit toggle skeleton */}
        <div className="flex justify-end">
          <Skeleton className="h-8 w-12" />
        </div>

        {/* Field row skeletons */}
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg border p-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
