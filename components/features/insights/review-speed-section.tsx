import { getReviewSpeedInsights } from '@/prisma/data/insights';

import { ORG_TIMEZONE } from '@/lib/constants';
import { formatInstant } from '@/lib/dates';
import { formatDuration } from '@/lib/insights';
import type { InsightsCoverage, InsightsRange } from '@/lib/types';

import { InsightBarChart } from '@/components/features/insights/insight-bar-chart';
import {
  InsightCard,
  InsightCardSkeleton,
} from '@/components/features/insights/insight-card';
import {
  InsightSection,
  InsightSectionSkeleton,
} from '@/components/features/insights/insight-section';

const STAGE_LABELS: Record<string, string> = {
  applied: 'Applied',
  reached_out: 'Reached Out',
  interview_scheduled: 'Interview Scheduled',
  reviewing: 'Reviewing',
};

function formatCoverage(coverage: InsightsCoverage): string {
  if (!coverage.historyStart) return 'No status history recorded yet.';
  const start = formatInstant(coverage.historyStart, {
    precision: 'date',
    timeZone: ORG_TIMEZONE,
  });
  return `Based on ${coverage.coveredCount} of ${coverage.totalCount} applications submitted in this range. Status history starts ${start}; earlier submissions are left out.`;
}

interface ReviewSpeedSectionProps {
  range: InsightsRange;
}

export async function ReviewSpeedSection({ range }: ReviewSpeedSectionProps) {
  const speed = await getReviewSpeedInsights(range);

  return (
    <InsightSection slug="review-speed" title="Review Speed">
      <InsightCard
        title="Time to Decision"
        description="Time from submission to the first accept or reject."
        meta={formatCoverage(speed.timeToDecision.coverage)}
        takeaway={
          speed.timeToDecision.medianHours !== null
            ? `Median ${formatDuration(speed.timeToDecision.medianHours)} · ${speed.timeToDecision.awaitingCount} still awaiting a decision.`
            : undefined
        }
        isEmpty={speed.timeToDecision.n === 0}
        emptyMessage="No decisions in this range."
        table={{
          headers: ['Bucket', 'Count'],
          rows: speed.timeToDecision.histogram.map((b) => [b.label, b.count]),
        }}
      >
        <InsightBarChart
          data={speed.timeToDecision.histogram.map((b) => ({
            label: b.label,
            value: b.count,
          }))}
        />
      </InsightCard>

      <InsightCard
        title="Speed of First Reply"
        description="Time from submission to the first move off Applied — the 'did anyone look at it' metric."
        meta={formatCoverage(speed.firstReply.coverage)}
        takeaway={
          speed.firstReply.medianHours !== null
            ? `Median ${formatDuration(speed.firstReply.medianHours)}.`
            : undefined
        }
        isEmpty={speed.firstReply.n === 0}
        emptyMessage="No status changes in this range."
        table={{
          headers: ['Bucket', 'Count'],
          rows: speed.firstReply.histogram.map((b) => [b.label, b.count]),
        }}
      >
        <InsightBarChart
          data={speed.firstReply.histogram.map((b) => ({
            label: b.label,
            value: b.count,
          }))}
        />
      </InsightCard>

      <InsightCard
        title="Time in Stage"
        description="Median dwell time per stage, from consecutive status changes. Identifies the bottleneck."
        isEmpty={speed.timeInStage.every((s) => s.n === 0)}
        emptyMessage="No status changes in this range."
        table={{
          headers: ['Stage', 'Median', 'n'],
          rows: speed.timeInStage.map((s) => [
            STAGE_LABELS[s.status] ?? s.status,
            s.medianHours !== null ? formatDuration(s.medianHours) : '—',
            s.n,
          ]),
        }}
      >
        <InsightBarChart
          data={speed.timeInStage.map((s) => ({
            label: STAGE_LABELS[s.status] ?? s.status,
            value: s.medianHours !== null ? Math.round(s.medianHours) : 0,
          }))}
        />
      </InsightCard>

      <InsightCard
        title="Time to Complete a Draft"
        description="Time from starting a draft to first submitting it (first-time submitters only)."
        takeaway={
          speed.timeToComplete.medianHours !== null
            ? `Median ${formatDuration(speed.timeToComplete.medianHours)}.`
            : undefined
        }
        isEmpty={speed.timeToComplete.n === 0}
        emptyMessage="No submitted applications in this range."
        table={{
          headers: ['Bucket', 'Count'],
          rows: speed.timeToComplete.histogram.map((b) => [b.label, b.count]),
        }}
      >
        <InsightBarChart
          data={speed.timeToComplete.histogram.map((b) => ({
            label: b.label,
            value: b.count,
          }))}
        />
      </InsightCard>
    </InsightSection>
  );
}

export function ReviewSpeedSectionSkeleton() {
  return (
    <InsightSectionSkeleton title="Review Speed">
      <InsightCardSkeleton />
      <InsightCardSkeleton />
      <InsightCardSkeleton />
      <InsightCardSkeleton />
    </InsightSectionSkeleton>
  );
}
