import { getApplicantInsights } from '@/prisma/data/insights';

import type { InsightsRange } from '@/lib/types';

import { InsightBarChart } from '@/components/features/insights/insight-bar-chart';
import {
  InsightCard,
  InsightCardSkeleton,
} from '@/components/features/insights/insight-card';
import {
  InsightSection,
  InsightSectionSkeleton,
} from '@/components/features/insights/insight-section';
import {
  InsightTile,
  InsightTileSkeleton,
} from '@/components/features/insights/insight-tile';

interface ApplicantsSectionProps {
  range: InsightsRange;
}

export async function ApplicantsSection({ range }: ApplicantsSectionProps) {
  const applicants = await getApplicantInsights(range);

  return (
    <InsightSection slug="applicants" title="Applicants">
      <div className="grid grid-cols-2 gap-4">
        <InsightTile
          label="Unique applicants"
          value={String(applicants.uniqueApplicants)}
          caption={`${applicants.totalSubmitted} submitted applications`}
        />
        <InsightTile
          label="Repeat applicants"
          value={String(applicants.repeatApplicantCount)}
          caption="Applied to 2+ positions"
        />
      </div>

      <InsightCard
        title="Applications per Applicant"
        description="How many positions each applicant applied to."
        isEmpty={applicants.perApplicantBuckets.every((b) => b.count === 0)}
        emptyMessage="No submitted applications in this range."
        table={{
          headers: ['Applications', 'Applicants'],
          rows: applicants.perApplicantBuckets.map((b) => [b.label, b.count]),
        }}
      >
        <InsightBarChart
          data={applicants.perApplicantBuckets.map((b) => ({
            label: b.label,
            value: b.count,
          }))}
        />
      </InsightCard>

      {applicants.newVsReturning && (
        <div className="grid grid-cols-2 gap-4">
          <InsightTile
            label="New applicants"
            value={String(applicants.newVsReturning.new)}
          />
          <InsightTile
            label="Returning applicants"
            value={String(applicants.newVsReturning.returning)}
          />
        </div>
      )}

      <InsightCard
        title="Profile Completeness"
        description="Required-profile-question completeness for users created in this range."
        isEmpty={applicants.profileCompleteness.every((b) => b.count === 0)}
        emptyMessage="No new accounts in this range."
        table={{
          headers: ['Completeness', 'Users'],
          rows: applicants.profileCompleteness.map((b) => [b.label, b.count]),
        }}
      >
        <InsightBarChart
          data={applicants.profileCompleteness.map((b) => ({
            label: b.label,
            value: b.count,
          }))}
        />
      </InsightCard>

      <div className="grid grid-cols-2 gap-4">
        <InsightTile
          label="Signed up, started a draft"
          value={String(applicants.signupsNeverApplied.startedDraft)}
          caption="Never submitted"
        />
        <InsightTile
          label="Signed up, never started"
          value={String(applicants.signupsNeverApplied.neverStarted)}
        />
      </div>
    </InsightSection>
  );
}

export function ApplicantsSectionSkeleton() {
  return (
    <InsightSectionSkeleton title="Applicants">
      <div className="grid grid-cols-2 gap-4">
        <InsightTileSkeleton />
        <InsightTileSkeleton />
      </div>
      <InsightCardSkeleton />
      <InsightCardSkeleton />
      <div className="grid grid-cols-2 gap-4">
        <InsightTileSkeleton />
        <InsightTileSkeleton />
      </div>
    </InsightSectionSkeleton>
  );
}
