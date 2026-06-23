import { Suspense } from 'react';

import { OpenPositionsSummary } from '@/components/features/open-positions-summary';
import { PipelineSummary } from '@/components/features/pipeline-summary';
import { RecentApplications } from '@/components/features/recent-applications';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function PipelineSummarySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="p-4">
          <CardContent className="p-0">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-8 w-12" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RecentApplicationsSkeleton() {
  return (
    <Card className="gap-0 p-0">
      <CardHeader className="border-b p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-16" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-b px-4 py-4 last:border-0">
            <div className="hidden grid-cols-4 gap-4 md:grid">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-20 rounded-md" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex flex-col gap-2 md:hidden">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-20 rounded-md" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function OpenPositionsSummarySkeleton() {
  return (
    <Card className="gap-0 p-0">
      <CardHeader className="border-b p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between border-b px-4 py-3 last:border-0"
          >
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function AdminDashboard() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Overview of applications across all positions.
        </p>
      </div>

      <Suspense fallback={<PipelineSummarySkeleton />}>
        <PipelineSummary />
      </Suspense>

      <Suspense fallback={<RecentApplicationsSkeleton />}>
        <RecentApplications />
      </Suspense>

      <Suspense fallback={<OpenPositionsSummarySkeleton />}>
        <OpenPositionsSummary />
      </Suspense>
    </div>
  );
}
