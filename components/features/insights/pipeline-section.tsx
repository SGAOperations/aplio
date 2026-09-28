import { getPipelineInsights } from '@/prisma/data/insights';

import { APPLICATION_STATUS_LABELS } from '@/lib/constants';
import { percent } from '@/lib/insights';
import type { InsightsRange } from '@/lib/types';

import { InsightBarChart } from '@/components/features/insights/insight-bar-chart';
import {
  InsightCard,
  InsightCardSkeleton,
} from '@/components/features/insights/insight-card';
import { InsightHeatmap } from '@/components/features/insights/insight-heatmap';
import {
  InsightSection,
  InsightSectionSkeleton,
} from '@/components/features/insights/insight-section';
import { InsightStackedBarChart } from '@/components/features/insights/insight-stacked-bar-chart';
import {
  InsightTile,
  InsightTileSkeleton,
} from '@/components/features/insights/insight-tile';

const MATRIX_STATUSES = [
  'applied',
  'reached_out',
  'interview_scheduled',
  'reviewing',
  'accepted',
  'rejected',
  'withdrawn',
] as const;

// `key` must be CSS-custom-property-safe (no spaces); `sourceKey` is the
// human label prisma/data/insights.ts#outcomeBucket groups by.
const OUTCOME_KEYS = [
  { key: 'accepted', sourceKey: 'Accepted', label: 'Accepted' },
  { key: 'rejected', sourceKey: 'Rejected', label: 'Rejected' },
  { key: 'withdrawn', sourceKey: 'Withdrawn', label: 'Withdrawn' },
  { key: 'stillOpen', sourceKey: 'Still open', label: 'Still open' },
];

interface PipelineSectionProps {
  range: InsightsRange;
}

export async function PipelineSection({ range }: PipelineSectionProps) {
  const pipeline = await getPipelineInsights(range);

  const matrixList = pipeline.transitionMatrix
    .slice()
    .sort((a, b) => b.count - a.count);
  const matrixValues = MATRIX_STATUSES.map((from) =>
    MATRIX_STATUSES.map(
      (to) =>
        pipeline.transitionMatrix.find((c) => c.from === from && c.to === to)
          ?.count ?? 0,
    ),
  );

  return (
    <InsightSection slug="pipeline" title="Pipeline">
      <InsightCard
        title="Status Transition Matrix"
        description="Every from -> to status change, real events only."
        meta={`n = ${pipeline.n}`}
        isEmpty={pipeline.n === 0}
        emptyMessage="No status changes in this range."
        table={{
          headers: ['From', 'To', 'Count'],
          rows: matrixList.map((c) => [
            APPLICATION_STATUS_LABELS[c.from],
            APPLICATION_STATUS_LABELS[c.to],
            c.count,
          ]),
        }}
      >
        <ul className="flex flex-col gap-1 text-sm md:hidden">
          {matrixList.slice(0, 10).map((c, i) => (
            <li key={i} className="flex items-center justify-between gap-2">
              <span className="truncate">
                {APPLICATION_STATUS_LABELS[c.from]} →{' '}
                {APPLICATION_STATUS_LABELS[c.to]}
              </span>
              <span className="text-muted-foreground shrink-0">{c.count}</span>
            </li>
          ))}
        </ul>
        <div className="hidden md:block">
          <InsightHeatmap
            rowLabels={MATRIX_STATUSES.map((s) => APPLICATION_STATUS_LABELS[s])}
            colLabels={MATRIX_STATUSES.map((s) => APPLICATION_STATUS_LABELS[s])}
            values={matrixValues}
            ariaLabel="Status transition matrix"
          />
        </div>
      </InsightCard>

      <div className="grid grid-cols-2 gap-4">
        <InsightTile
          label="Backward moves"
          value={String(pipeline.backwardCount)}
          caption={
            pipeline.reviewerEventCount > 0
              ? `${percent(pipeline.backwardCount, pipeline.reviewerEventCount)}% of reviewer events`
              : undefined
          }
        />
        <InsightTile
          label="Decision flips"
          value={String(pipeline.decisionFlipCount)}
          caption={
            pipeline.reviewerEventCount > 0
              ? `${percent(pipeline.decisionFlipCount, pipeline.reviewerEventCount)}% of reviewer events`
              : undefined
          }
        />
      </div>

      <InsightCard
        title="Outcome Mix"
        description="Current status of submitted applications: accepted, rejected, withdrawn, or still open."
        isEmpty={pipeline.outcomeMix.every((o) => o.count === 0)}
        emptyMessage="No submitted applications in this range."
        table={{
          headers: ['Position', ...OUTCOME_KEYS.map((k) => k.label)],
          rows: pipeline.outcomeMixByPosition.map((r) => [
            r.title,
            ...OUTCOME_KEYS.map((k) => r.counts[k.sourceKey] ?? 0),
          ]),
        }}
      >
        <InsightStackedBarChart
          data={pipeline.outcomeMixByPosition.map((r) => ({
            label: r.title,
            ...Object.fromEntries(
              OUTCOME_KEYS.map((k) => [k.key, r.counts[k.sourceKey] ?? 0]),
            ),
          }))}
          keys={OUTCOME_KEYS}
        />
      </InsightCard>

      <InsightCard
        title="Withdrawal Timing"
        description="Status an application was in when withdrawn, split by who acted — plus resubmissions after a withdrawal."
        meta={`${pipeline.resubmissionCount} resubmission${pipeline.resubmissionCount === 1 ? '' : 's'} after a withdrawal.`}
        isEmpty={pipeline.withdrawalTiming.every((w) => w.count === 0)}
        emptyMessage="No withdrawals in this range."
        table={{
          headers: ['From', 'Actor', 'Count'],
          rows: pipeline.withdrawalTiming.map((w) => [
            APPLICATION_STATUS_LABELS[w.from],
            w.actor === 'applicant' ? 'Applicant' : 'Admin (force)',
            w.count,
          ]),
        }}
      >
        <InsightBarChart
          data={pipeline.withdrawalTiming.map((w) => ({
            label: `${APPLICATION_STATUS_LABELS[w.from]} (${w.actor})`,
            value: w.count,
          }))}
        />
      </InsightCard>
    </InsightSection>
  );
}

export function PipelineSectionSkeleton() {
  return (
    <InsightSectionSkeleton title="Pipeline">
      <InsightCardSkeleton />
      <div className="grid grid-cols-2 gap-4">
        <InsightTileSkeleton />
        <InsightTileSkeleton />
      </div>
      <InsightCardSkeleton />
      <InsightCardSkeleton />
    </InsightSectionSkeleton>
  );
}
