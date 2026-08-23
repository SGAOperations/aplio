import { Suspense } from 'react';

import { type Reviewer } from '@/lib/types';

import { ReviewerActivityFeed } from '@/components/features/activity-feed';
import { OpenPositionsSummary } from '@/components/features/open-positions-summary';
import {
  PipelineSummary,
  PipelineSummarySkeleton,
} from '@/components/features/pipeline-summary';
import { RecentApplications } from '@/components/features/recent-applications';
import { SectionCardSkeleton } from '@/components/ui/section-card';

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

      <Suspense fallback={<SectionCardSkeleton rowShape="badge-meta" />}>
        <RecentApplications reviewer={reviewer} limit={3} />
      </Suspense>

      <Suspense fallback={<SectionCardSkeleton rowShape="meta" />}>
        <OpenPositionsSummary take={3} />
      </Suspense>

      <Suspense
        fallback={
          <SectionCardSkeleton rowShape="timeline" rows={10} hasLink={false} />
        }
      >
        <ReviewerActivityFeed reviewer={reviewer} />
      </Suspense>
    </div>
  );
}
