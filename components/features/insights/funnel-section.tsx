import { getFunnelInsights } from '@/prisma/data/insights';

import { maxByValue } from '@/lib/insights';
import type { InsightsRange } from '@/lib/types';

import { InsightBarChart } from '@/components/features/insights/insight-bar-chart';
import {
  InsightCard,
  InsightCardSkeleton,
} from '@/components/features/insights/insight-card';
import { InsightScatterChart } from '@/components/features/insights/insight-scatter-chart';
import {
  InsightSection,
  InsightSectionSkeleton,
} from '@/components/features/insights/insight-section';
import { InsightTile } from '@/components/features/insights/insight-tile';

interface FunnelSectionProps {
  range: InsightsRange;
}

export async function FunnelSection({ range }: FunnelSectionProps) {
  const funnel = await getFunnelInsights(range);
  const topConversionPosition = maxByValue(
    funnel.conversionByPosition,
    (r) => r.rate ?? 0,
  );
  const modeAbandonmentBucket = maxByValue(
    funnel.abandonment.ageBuckets,
    (b) => b.count,
  );
  const topDropoff = funnel.dropoff[0];
  const topFormLengthPosition = maxByValue(
    funnel.formLengthVsConversion,
    (r) => r.conversionRate,
  );

  return (
    <InsightSection slug="funnel" title="Funnel">
      <div className="flex flex-col gap-4">
        <InsightTile
          label="Draft -> submit conversion"
          value={
            funnel.conversion.rate !== null ? `${funnel.conversion.rate}%` : '—'
          }
          caption={`${funnel.conversion.converted} of ${funnel.conversion.starts} drafts started in this range`}
        />
        <InsightCard
          title="Conversion by Position"
          description="Share of drafts started in this range that reached Applied."
          meta={`n = ${funnel.conversionByPosition.reduce((sum, r) => sum + r.starts, 0)}`}
          takeaway={
            topConversionPosition
              ? `${topConversionPosition.title} converts highest at ${topConversionPosition.rate}%.`
              : undefined
          }
          isEmpty={funnel.conversionByPosition.length === 0}
          emptyMessage="No positions with enough drafts in this range."
        >
          <InsightBarChart
            data={funnel.conversionByPosition.map((r) => ({
              label: r.title,
              value: r.rate ?? 0,
            }))}
          />
        </InsightCard>
      </div>

      <InsightCard
        title="Draft Abandonment"
        description="Drafts inactive for 14+ days without submitting."
        meta={`${funnel.abandonment.count} abandoned draft${funnel.abandonment.count === 1 ? '' : 's'}`}
        takeaway={
          modeAbandonmentBucket && modeAbandonmentBucket.count > 0
            ? `${modeAbandonmentBucket.label} is the most common (${modeAbandonmentBucket.count}).`
            : undefined
        }
        isEmpty={funnel.abandonment.count === 0}
        emptyMessage="No abandoned drafts."
      >
        <InsightBarChart
          data={funnel.abandonment.ageBuckets.map((b) => ({
            label: b.label,
            value: b.count,
          }))}
        />
      </InsightCard>

      <InsightCard
        title="Where Applicants Quit"
        description="The last question with an answer before an abandoned draft went stale — current question order and labels."
        meta={`n = ${funnel.dropoff.reduce((sum, d) => sum + d.count, 0)}`}
        takeaway={
          topDropoff
            ? `Most abandon before "${topDropoff.nextQuestionLabel ?? 'finished all visible questions'}" on ${topDropoff.title} (${topDropoff.count}).`
            : undefined
        }
        isEmpty={funnel.dropoff.length === 0}
        emptyMessage="No abandoned drafts with enough volume in this range."
      >
        <InsightBarChart
          data={funnel.dropoff.map((d) => ({
            label: `${d.title}: ${d.nextQuestionLabel ?? 'finished'}`,
            value: d.count,
          }))}
        />
      </InsightCard>

      <InsightCard
        title="Form Length vs. Conversion"
        description="Live required question count against draft->submit conversion, per position."
        meta={`n = ${funnel.formLengthVsConversion.length}`}
        takeaway={
          topFormLengthPosition
            ? `${topFormLengthPosition.title} converts best at ${topFormLengthPosition.conversionRate}% with ${topFormLengthPosition.requiredQuestionCount} required question${topFormLengthPosition.requiredQuestionCount === 1 ? '' : 's'}.`
            : undefined
        }
        isEmpty={funnel.formLengthVsConversion.length === 0}
        emptyMessage="No positions with enough drafts in this range."
      >
        <InsightScatterChart
          data={funnel.formLengthVsConversion.map((r) => ({
            x: r.requiredQuestionCount,
            y: r.conversionRate,
            label: r.title,
            n: r.starts,
          }))}
        />
      </InsightCard>
    </InsightSection>
  );
}

export function FunnelSectionSkeleton() {
  return (
    <InsightSectionSkeleton title="Funnel">
      <InsightCardSkeleton />
      <InsightCardSkeleton />
      <InsightCardSkeleton />
      <InsightCardSkeleton />
    </InsightSectionSkeleton>
  );
}
