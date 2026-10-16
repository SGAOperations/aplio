'use client';

import { useState } from 'react';

import type {
  SeriesPoint,
  StackedSeriesKey,
  StackedSeriesPoint,
} from '@/lib/types';

import { InsightCard } from '@/components/features/insights/insight-card';
import { InsightStackedBarChart } from '@/components/features/insights/insight-stacked-bar-chart';
import { InsightTimeSeriesChart } from '@/components/features/insights/insight-time-series-chart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type VolumeTrendView = 'total' | 'position';

interface VolumeTrendCardProps {
  series: SeriesPoint[];
  stackedSeries: StackedSeriesPoint[];
  stackedKeys: StackedSeriesKey[];
  meta: string;
  takeaway?: string;
  isEmpty: boolean;
  emptyMessage: string;
}

/** "Applications Per Day", with the total/by-position toggle as a top-right dropdown. */
export function VolumeTrendCard({
  series,
  stackedSeries,
  stackedKeys,
  meta,
  takeaway,
  isEmpty,
  emptyMessage,
}: VolumeTrendCardProps) {
  const [view, setView] = useState<VolumeTrendView>('total');

  return (
    <InsightCard
      title="Applications Per Day"
      description="Submitted applications over time, org-local days."
      meta={meta}
      takeaway={takeaway}
      isEmpty={isEmpty}
      emptyMessage={emptyMessage}
      headerAction={
        <Select
          value={view}
          onValueChange={(value) => setView(value as VolumeTrendView)}
        >
          <SelectTrigger size="sm" className="w-32" aria-label="Chart view">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="total">Total</SelectItem>
            <SelectItem value="position">By position</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      {view === 'total' ? (
        <InsightTimeSeriesChart data={series} />
      ) : (
        <InsightStackedBarChart
          data={stackedSeries.map((p) => ({ label: p.day, ...p.values }))}
          keys={stackedKeys.map((k) => ({ key: k.positionId, label: k.label }))}
        />
      )}
    </InsightCard>
  );
}
