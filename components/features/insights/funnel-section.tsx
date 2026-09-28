import { getFunnelInsights } from '@/prisma/data/insights';

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
          isEmpty={funnel.conversionByPosition.length === 0}
          emptyMessage="No positions with enough drafts in this range."
          table={{
            headers: ['Position', 'Starts', 'Converted', 'Rate'],
            rows: funnel.conversionByPosition.map((r) => [
              r.title,
              r.starts,
              r.converted,
              r.rate !== null ? `${r.rate}%` : '—',
            ]),
          }}
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
        isEmpty={funnel.abandonment.count === 0}
        emptyMessage="No abandoned drafts."
        table={{
          headers: ['Age', 'Count'],
          rows: funnel.abandonment.ageBuckets.map((b) => [b.label, b.count]),
        }}
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
        isEmpty={funnel.dropoff.length === 0}
        emptyMessage="No abandoned drafts with enough volume in this range."
        table={{
          headers: ['Position', 'Stopped before', 'Count'],
          rows: funnel.dropoff.map((d) => [
            d.title,
            d.nextQuestionLabel ?? 'Finished all visible questions',
            d.count,
          ]),
        }}
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
        isEmpty={funnel.formLengthVsConversion.length === 0}
        emptyMessage="No positions with enough drafts in this range."
        table={{
          headers: ['Position', 'Required Questions', 'Conversion', 'n'],
          rows: funnel.formLengthVsConversion.map((r) => [
            r.title,
            r.requiredQuestionCount,
            `${r.conversionRate}%`,
            r.starts,
          ]),
        }}
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
