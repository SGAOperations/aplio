'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { INSIGHT_CHART_HEIGHT_CLASS } from '@/lib/insights';

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

const SERIES_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

interface InsightStackedBarChartProps {
  data: Record<string, string | number>[];
  keys: { key: string; label: string }[];
  labelKey?: string;
}

/** A stacked bar chart over an arbitrary category axis (day, position, outcome…). */
export function InsightStackedBarChart({
  data,
  keys,
  labelKey = 'label',
}: InsightStackedBarChartProps) {
  const config = Object.fromEntries(
    keys.map((k, i) => [
      k.key,
      { label: k.label, color: SERIES_COLORS[i % SERIES_COLORS.length] },
    ]),
  ) satisfies ChartConfig;

  return (
    <ChartContainer config={config} className={INSIGHT_CHART_HEIGHT_CLASS}>
      <BarChart data={data} accessibilityLayer margin={{ left: 4, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey={labelKey}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          width={32}
          allowDecimals={false}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {keys.map((k) => (
          <Bar
            key={k.key}
            dataKey={k.key}
            stackId="a"
            fill={`var(--color-${k.key})`}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
