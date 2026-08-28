import { Suspense } from 'react';

import { getFirstName } from '@/lib/utils';

import { ApplicantActivityFeed } from '@/components/features/activity-feed';
import {
  ApplicantSummary,
  ApplicantSummarySkeleton,
} from '@/components/features/applicant-summary';
import { MyApplicationsWidget } from '@/components/features/my-applications-widget';
import { OpenPositionsWidget } from '@/components/features/open-positions-widget';
import { ProfileCompletenessBanner } from '@/components/features/profile-completeness-banner';
import { SectionCardSkeleton } from '@/components/ui/section-card';

interface UserDashboardProps {
  userId: string;
  userName: string | null;
}

export function UserDashboard({ userId, userName }: UserDashboardProps) {
  const firstName = getFirstName(userName);
  const heading = firstName ? `Welcome back, ${firstName}` : 'Welcome to Aplio';

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Here&apos;s a summary of your applications.
        </p>
      </div>

      {/* Fixed-height placeholder prevents CLS when the banner resolves and is present. */}
      <Suspense fallback={<div className="h-[68px]" />}>
        <ProfileCompletenessBanner userId={userId} />
      </Suspense>

      <Suspense fallback={<ApplicantSummarySkeleton />}>
        <ApplicantSummary userId={userId} />
      </Suspense>

      <Suspense
        fallback={<SectionCardSkeleton rowShape="badge-meta" hasSubtitle />}
      >
        <MyApplicationsWidget userId={userId} limit={3} />
      </Suspense>

      <Suspense fallback={<SectionCardSkeleton rowShape="stacked-action" />}>
        <OpenPositionsWidget limit={3} />
      </Suspense>

      <Suspense
        fallback={
          <SectionCardSkeleton rowShape="timeline" rows={10} hasLink={false} />
        }
      >
        <ApplicantActivityFeed userId={userId} />
      </Suspense>
    </div>
  );
}
