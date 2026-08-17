import { Suspense } from 'react';

import { type Reviewer } from '@/lib/types';

import {
  ActivityFeedSkeleton,
  ReviewerActivityFeed,
} from '@/components/features/activity-feed';
import { OpenPositionsSummary } from '@/components/features/open-positions-summary';
import {
  PipelineSummary,
  PipelineSummarySkeleton,
} from '@/components/features/pipeline-summary';
import {
  RecentApplications,
  RecentApplicationsSkeleton,
} from '@/components/features/recent-applications';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

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

interface AdminDashboardProps {
  reviewer: Reviewer;
}

export function AdminDashboard({ reviewer }: AdminDashboardProps) {
  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Overview of applications across all positions.
        </p>
      </div>

      <Suspense fallback={<PipelineSummarySkeleton />}>
        <PipelineSummary reviewer={reviewer} />
      </Suspense>

      <Suspense fallback={<RecentApplicationsSkeleton />}>
        <RecentApplications reviewer={reviewer} limit={3} />
      </Suspense>

      <Suspense fallback={<OpenPositionsSummarySkeleton />}>
        <OpenPositionsSummary take={3} />
      </Suspense>

      <Suspense fallback={<ActivityFeedSkeleton />}>
        <ReviewerActivityFeed reviewer={reviewer} />
      </Suspense>
    </div>
  );
}
