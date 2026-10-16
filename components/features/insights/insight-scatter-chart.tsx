'use client';

import { CartesianGrid, Scatter, ScatterChart, XAxis, YAxis } from 'recharts';

import { INSIGHT_CHART_HEIGHT_CLASS } from '@/lib/insights';

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

const SCATTER_CONFIG = {
  y: { label: 'Conversion rate', color: 'var(--chart-1)' },
} satisfies ChartConfig;

interface InsightScatterPoint {
  x: number;
  y: number;
  label: string;
  n: number;
}

interface InsightScatterChartProps {
  data: InsightScatterPoint[];
}

/** Required-question count (x) vs. draft->submit conversion rate (y). */
export function InsightScatterChart({ data }: InsightScatterChartProps) {
  return (
    <ChartContainer
      config={SCATTER_CONFIG}
      className={INSIGHT_CHART_HEIGHT_CLASS}
    >
      <ScatterChart
        accessibilityLayer
        margin={{ left: 4, right: 12, bottom: 4 }}
      >
        <CartesianGrid />
        <XAxis
          type="number"
          dataKey="x"
          name="Required questions"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          allowDecimals={false}
        />
        <YAxis
          type="number"
          dataKey="y"
          name="Conversion %"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          width={32}
        />
        <ChartTooltip
          cursor={{ strokeDasharray: '3 3' }}
          content={
            <ChartTooltipContent
              labelFormatter={() => ''}
              formatter={(value, name, item) => {
                const point = item.payload as InsightScatterPoint;
                return [`${point.label} — n = ${point.n}`, `${name}: ${value}`];
              }}
            />
          }
        />
        <Scatter data={data} fill="var(--color-y)" />
      </ScatterChart>
    </ChartContainer>
  );
}
