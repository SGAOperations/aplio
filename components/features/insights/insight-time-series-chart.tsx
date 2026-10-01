'use client';

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { INSIGHT_CHART_HEIGHT_CLASS } from '@/lib/insights';

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

const TIME_SERIES_CONFIG = {
  count: { label: 'Submissions', color: 'var(--chart-1)' },
} satisfies ChartConfig;

interface InsightTimeSeriesChartProps {
  data: { day: string; count: number }[];
}

/** A single-series area chart over org-local day/week buckets. */
export function InsightTimeSeriesChart({ data }: InsightTimeSeriesChartProps) {
  return (
    <ChartContainer
      config={TIME_SERIES_CONFIG}
      className={INSIGHT_CHART_HEIGHT_CLASS}
    >
      <AreaChart data={data} accessibilityLayer margin={{ left: 4, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          minTickGap={24}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          width={32}
          allowDecimals={false}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          dataKey="count"
          type="monotone"
          fill="var(--color-count)"
          fillOpacity={0.2}
          stroke="var(--color-count)"
        />
      </AreaChart>
    </ChartContainer>
  );
}
