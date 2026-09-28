import { getVolumeInsights } from '@/prisma/data/insights';

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
import { InsightTimeSeriesChart } from '@/components/features/insights/insight-time-series-chart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const BLOCK_LABELS = [
  '00:00',
  '03:00',
  '06:00',
  '09:00',
  '12:00',
  '15:00',
  '18:00',
  '21:00',
];

interface VolumeSectionProps {
  range: InsightsRange;
}

export async function VolumeSection({ range }: VolumeSectionProps) {
  const volume = await getVolumeInsights(range);

  const heatmapValues = WEEKDAY_LABELS.map((_, weekday) =>
    BLOCK_LABELS.map(
      (_, block) =>
        volume.heatmap.find((h) => h.weekday === weekday && h.block === block)
          ?.count ?? 0,
    ),
  );

  return (
    <InsightSection slug="volume" title="Volume">
      <InsightCard
        title="Applications Per Day"
        description="Submitted applications over time, org-local days."
        meta={`n = ${volume.n}`}
        isEmpty={volume.n === 0}
        emptyMessage="No submitted applications in this range."
        table={{
          headers: ['Day', 'Count'],
          rows: volume.series.map((p) => [p.day, p.count]),
        }}
      >
        <Tabs defaultValue="total">
          <TabsList>
            <TabsTrigger value="total">Total</TabsTrigger>
            <TabsTrigger value="position">By position</TabsTrigger>
          </TabsList>
          <TabsContent value="total">
            <InsightTimeSeriesChart data={volume.series} />
          </TabsContent>
          <TabsContent value="position">
            <InsightStackedBarChart
              data={volume.stackedSeries.map((p) => ({
                label: p.day,
                ...p.values,
              }))}
              keys={volume.stackedKeys.map((k) => ({
                key: k.positionId,
                label: k.label,
              }))}
            />
          </TabsContent>
        </Tabs>
      </InsightCard>

      <InsightCard
        title="Most Applied-To Positions"
        description="Submitted application counts per position, and normalised per day the position was open."
        meta={
          volume.droppedFromRate > 0
            ? `${volume.droppedFromRate} position${volume.droppedFromRate === 1 ? '' : 's'} with fewer than 5 applications aren't shown in the rate view.`
            : undefined
        }
        isEmpty={volume.mostAppliedAll.length === 0}
        emptyMessage="No submitted applications in this range."
        table={{
          headers: ['Position', 'Applications'],
          rows: volume.mostAppliedAll.map((r) => [r.title, r.count]),
        }}
      >
        <Tabs defaultValue="count">
          <TabsList>
            <TabsTrigger value="count">Applications</TabsTrigger>
            <TabsTrigger value="rate">Per open day</TabsTrigger>
          </TabsList>
          <TabsContent value="count">
            <InsightBarChart
              data={volume.mostAppliedTop.map((r) => ({
                label: r.title,
                value: r.count,
              }))}
            />
          </TabsContent>
          <TabsContent value="rate">
            <InsightBarChart
              data={volume.mostAppliedPerOpenDay
                .slice(0, 10)
                .map((r) => ({
                  label: r.title,
                  value: Math.round(r.rate * 100) / 100,
                }))}
            />
          </TabsContent>
        </Tabs>
      </InsightCard>

      <InsightCard
        title="Submission Heatmap"
        description="Weekday × time of day, org-local, submitted applications."
        isEmpty={volume.n === 0}
        emptyMessage="No submitted applications in this range."
      >
        <InsightHeatmap
          rowLabels={WEEKDAY_LABELS}
          colLabels={BLOCK_LABELS}
          values={heatmapValues}
          ariaLabel="Submissions by weekday and time of day"
        />
      </InsightCard>

      <InsightCard
        title="Deadline Rush"
        description="Time remaining until the position's deadline, for positions with a close date."
        isEmpty={volume.deadlineRush.every((b) => b.count === 0)}
        emptyMessage="No submitted applications with a deadline in this range."
        table={{
          headers: ['Window', 'Count'],
          rows: volume.deadlineRush.map((b) => [b.label, b.count]),
        }}
      >
        <InsightBarChart
          data={volume.deadlineRush.map((b) => ({
            label: b.label,
            value: b.count,
          }))}
        />
      </InsightCard>
    </InsightSection>
  );
}

export function VolumeSectionSkeleton() {
  return (
    <InsightSectionSkeleton title="Volume">
      <InsightCardSkeleton />
      <InsightCardSkeleton />
      <InsightCardSkeleton />
      <InsightCardSkeleton />
    </InsightSectionSkeleton>
  );
}
