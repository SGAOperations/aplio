import { Suspense } from 'react';

import { type Reviewer } from '@/lib/types';

import {
  ActivityFeedSkeleton,
  ReviewerActivityFeed,
} from '@/components/features/activity-feed';
import {
  ManagedPositionsWidget,
  ManagedPositionsWidgetSkeleton,
} from '@/components/features/managed-positions-widget';
import {
  MyApplicationsWidget,
  MyApplicationsWidgetSkeleton,
} from '@/components/features/my-applications-widget';
import {
  PipelineSummary,
  PipelineSummarySkeleton,
} from '@/components/features/pipeline-summary';
import {
  RecentApplications,
  RecentApplicationsSkeleton,
} from '@/components/features/recent-applications';

interface ManagerDashboardProps {
  user: Reviewer;
}

export function ManagerDashboard({ user }: ManagerDashboardProps) {
  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Overview of applications for the positions you manage.
        </p>
      </div>

      <Suspense fallback={<PipelineSummarySkeleton />}>
        <PipelineSummary reviewer={user} />
      </Suspense>

      <Suspense fallback={<RecentApplicationsSkeleton />}>
        <RecentApplications reviewer={user} limit={3} />
      </Suspense>

      <Suspense fallback={<ManagedPositionsWidgetSkeleton />}>
        <ManagedPositionsWidget userId={user.id} take={3} />
      </Suspense>

      <Suspense fallback={<ActivityFeedSkeleton />}>
        <ReviewerActivityFeed reviewer={user} />
      </Suspense>

      <Suspense fallback={<MyApplicationsWidgetSkeleton />}>
        <MyApplicationsWidget userId={user.id} limit={3} />
      </Suspense>
    </div>
  );
}
