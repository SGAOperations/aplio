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

const AXIS_CHARACTER_WIDTH_PX = 6.5;
const MIN_AXIS_WIDTH_PX = 80;
const MAX_AXIS_WIDTH_PX = 220;

interface InsightBarChartProps {
  data: { label: string; value: number }[];
}

/** Horizontal single-series bar — the shape for every "most/least X" chart. */
export function InsightBarChart({ data }: InsightBarChartProps) {
  const rowHeight = 28;
  const height = Math.max(160, data.length * rowHeight + 40);
  const longestLabel = data.reduce(
    (max, d) => Math.max(max, d.label.length),
    0,
  );
  const axisWidth = Math.min(
    MAX_AXIS_WIDTH_PX,
    Math.max(MIN_AXIS_WIDTH_PX, longestLabel * AXIS_CHARACTER_WIDTH_PX),
  );

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
          width={axisWidth}
          tick={{ fontSize: 11 }}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
