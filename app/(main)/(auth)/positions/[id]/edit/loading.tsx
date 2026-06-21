import { Skeleton } from '@/components/ui/skeleton';

export default function EditPositionLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-4">
          <Skeleton className="h-6 w-20" />
          <div className="flex flex-col gap-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-24" />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <Skeleton className="h-6 w-40" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
          <Skeleton className="h-9 w-36" />
        </section>

        <section className="flex flex-col gap-4">
          <Skeleton className="h-6 w-24" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12 w-full" />
          </div>
          <Skeleton className="h-9 w-36" />
        </section>
      </div>
    </div>
  );
}
