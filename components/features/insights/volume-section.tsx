import { getVolumeInsights } from '@/prisma/data/insights';

import { maxByValue } from '@/lib/insights';
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
import { VolumeTrendCard } from '@/components/features/insights/volume-trend-card';

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

  const peakDay = maxByValue(volume.series, (p) => p.count);
  const topPosition = volume.mostAppliedAll[0];
  const topRatePosition = volume.mostAppliedPerOpenDay[0];
  const peakCell = maxByValue(volume.heatmap, (h) => h.count);
  const topDeadlineBucket = maxByValue(volume.deadlineRush, (b) => b.count);

  return (
    <InsightSection slug="volume" title="Volume">
      <VolumeTrendCard
        series={volume.series}
        stackedSeries={volume.stackedSeries}
        stackedKeys={volume.stackedKeys}
        meta={`${volume.n} submitted application${volume.n === 1 ? '' : 's'}`}
        takeaway={
          peakDay && peakDay.count > 0
            ? `Busiest: ${peakDay.day} with ${peakDay.count} submissions.`
            : undefined
        }
        isEmpty={volume.n === 0}
        emptyMessage="No submitted applications in this range."
      />

      <InsightCard
        title="Most Applied-To Positions"
        description="Submitted application counts per position."
        meta={`${volume.n} submitted application${volume.n === 1 ? '' : 's'}`}
        takeaway={
          topPosition
            ? `${topPosition.title} leads with ${topPosition.count} applications.`
            : undefined
        }
        isEmpty={volume.mostAppliedAll.length === 0}
        emptyMessage="No submitted applications in this range."
      >
        <InsightBarChart
          data={volume.mostAppliedTop.map((r) => ({
            label: r.title,
            value: r.count,
          }))}
        />
      </InsightCard>

      <InsightCard
        title="Applications Per Open Day"
        description="How many applications a position gets per day it's been open — lets a day-old posting and a month-old one be compared fairly."
        meta={`n = ${volume.mostAppliedPerOpenDay.length}${
          volume.droppedFromRate > 0
            ? ` · ${volume.droppedFromRate} position${volume.droppedFromRate === 1 ? '' : 's'} with fewer than 5 applications aren't shown here.`
            : ''
        }`}
        takeaway={
          topRatePosition
            ? `${topRatePosition.title} leads at ${Math.round(topRatePosition.rate * 100) / 100}/day.`
            : undefined
        }
        isEmpty={volume.mostAppliedPerOpenDay.length === 0}
        emptyMessage="No positions with enough applications to rate in this range."
      >
        <InsightBarChart
          data={volume.mostAppliedPerOpenDay
            .slice(0, 10)
            .map((r) => ({
              label: r.title,
              value: Math.round(r.rate * 100) / 100,
            }))}
        />
      </InsightCard>

      <InsightCard
        title="Submission Heatmap"
        description="Which day of the week and time of day applicants submit most often, Eastern Time."
        meta={`${volume.n} submitted application${volume.n === 1 ? '' : 's'}`}
        takeaway={
          peakCell && peakCell.count > 0
            ? `Busiest: ${WEEKDAY_LABELS[peakCell.weekday]} ${BLOCK_LABELS[peakCell.block]} (${peakCell.count} submissions).`
            : undefined
        }
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
        meta={`n = ${volume.deadlineRush.reduce((sum, b) => sum + b.count, 0)}`}
        takeaway={
          topDeadlineBucket && topDeadlineBucket.count > 0
            ? `${topDeadlineBucket.label} is the most common window (${topDeadlineBucket.count}).`
            : undefined
        }
        isEmpty={volume.deadlineRush.every((b) => b.count === 0)}
        emptyMessage="No submitted applications with a deadline in this range."
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
      <InsightCardSkeleton />
    </InsightSectionSkeleton>
  );
}
