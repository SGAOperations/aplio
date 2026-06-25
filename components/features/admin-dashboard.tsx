import { Suspense } from 'react';

import {
  ActivityFeedSkeleton,
  AdminActivityFeed,
} from '@/components/features/activity-feed';
import { OpenPositionsSummary } from '@/components/features/open-positions-summary';
import { PipelineSummary } from '@/components/features/pipeline-summary';
import { RecentApplications } from '@/components/features/recent-applications';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function PipelineSummarySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
      {Array.from({ length: 7 }).map((_, i) => (
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
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b px-4 py-3 last:border-0"
          >
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-5 w-20 rounded-md" />
            <Skeleton className="h-4 w-20" />
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
        {Array.from({ length: 3 }).map((_, i) => (
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
        <RecentApplications limit={3} />
      </Suspense>

      <Suspense fallback={<OpenPositionsSummarySkeleton />}>
        <OpenPositionsSummary take={3} />
      </Suspense>

      <Suspense fallback={<ActivityFeedSkeleton />}>
        <AdminActivityFeed />
      </Suspense>
    </div>
  );
}
