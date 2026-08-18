import { Skeleton } from '@/components/ui/skeleton';

export default function EditPositionLoading() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      {/* PageHeader skeleton: back link + title + description */}
      <div className="flex flex-col gap-1">
        <Skeleton className="mb-1 h-7 w-32" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-24" />
      </div>

      <div className="flex flex-col gap-4">
        {/* Tab bar skeleton */}
        <div className="flex gap-1 rounded-lg border p-1">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 flex-1" />
        </div>

        {/* Tab content skeleton — loose shape fits both the editable form and the archived read-only view */}
        <div className="mt-2 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      {/* Danger zone skeleton — admin-only, shown speculatively to avoid layout shift */}
      <div className="flex flex-col gap-3 rounded-xl border p-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-36" />
      </div>
    </div>
  );
}
