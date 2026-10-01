'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { INSIGHT_CHART_HEIGHT_CLASS } from '@/lib/insights';

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

const BAR_CHART_CONFIG = {
  value: { label: 'Count', color: 'var(--chart-1)' },
} satisfies ChartConfig;

const MAX_TICK_LABEL_LENGTH = 16;

function truncateTick(value: string): string {
  return value.length > MAX_TICK_LABEL_LENGTH
    ? `${value.slice(0, MAX_TICK_LABEL_LENGTH)}…`
    : value;
}

interface InsightBarChartProps {
  data: { label: string; value: number }[];
}

/** Horizontal single-series bar — the shape for every "most/least X" chart. */
export function InsightBarChart({ data }: InsightBarChartProps) {
  const rowHeight = 28;
  const height = Math.max(160, data.length * rowHeight + 40);

  return (
    <ChartContainer
      config={BAR_CHART_CONFIG}
      className={INSIGHT_CHART_HEIGHT_CLASS}
      style={{ height }}
    >
      <BarChart
        data={data}
        layout="vertical"
        accessibilityLayer
        margin={{ left: 4, right: 12 }}
      >
        <CartesianGrid horizontal={false} />
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={110}
          tick={{ fontSize: 11 }}
          tickFormatter={truncateTick}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
