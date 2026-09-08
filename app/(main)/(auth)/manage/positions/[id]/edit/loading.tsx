import { SectionCardSkeleton } from '@/components/ui/section-card';
import { Skeleton } from '@/components/ui/skeleton';

export default function EditPositionLoading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      {/* PageHeader skeleton: back link + title + badge, one action bar */}
      <div className="flex flex-col gap-1">
        <Skeleton className="mb-1 h-7 w-32" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-5 w-16 rounded-md" />
          </div>
          <Skeleton className="h-9 w-40" />
        </div>
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Details */}
      <SectionCardSkeleton rowShape="form-field" rows={2} hasLink={false} />
      {/* Availability */}
      <SectionCardSkeleton rowShape="form-field" rows={2} hasLink={false} />
      {/* Managers */}
      <SectionCardSkeleton rowShape="form-field" rows={1} hasLink={false} />
      {/* Applications summary */}
      <SectionCardSkeleton rowShape="form-field" rows={1} hasSubtitle hasLink />
      {/* Questions */}
      <SectionCardSkeleton rowShape="form-field" rows={3} hasLink={false} />

      {/* Danger zone skeleton — compact, admin-only, shown speculatively to avoid layout shift */}
      <div className="flex flex-col gap-2 rounded-xl border p-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-36" />
      </div>
    </div>
  );
}
