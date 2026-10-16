const INTENSITY_CLASSES = [
  'bg-chart-1/10',
  'bg-chart-1/30',
  'bg-chart-1/50',
  'bg-chart-1/70',
  'bg-chart-1/90',
];

// Value is printed as text in every cell — colour is never the only channel.
function intensityClass(value: number, max: number): string {
  if (max <= 0 || value <= 0) return INTENSITY_CLASSES[0] as string;
  const index = Math.min(
    INTENSITY_CLASSES.length - 1,
    Math.floor((value / max) * INTENSITY_CLASSES.length),
  );
  return INTENSITY_CLASSES[index] as string;
}

interface InsightHeatmapProps {
  rowLabels: string[];
  colLabels: string[];
  values: number[][];
  ariaLabel: string;
}

/** A CSS grid, not a chart — every cell prints its own number. */
export function InsightHeatmap({
  rowLabels,
  colLabels,
  values,
  ariaLabel,
}: InsightHeatmapProps) {
  const max = Math.max(0, ...values.flat());

  return (
    <div role="img" aria-label={ariaLabel} className="overflow-x-auto">
      <div
        className="grid gap-0.5 text-[10px]"
        style={{
          gridTemplateColumns: `auto repeat(${colLabels.length}, minmax(1.75rem, 1fr))`,
        }}
      >
        <div />
        {colLabels.map((label) => (
          <div
            key={label}
            className="text-muted-foreground text-center font-medium"
          >
            {label}
          </div>
        ))}
        {rowLabels.map((rowLabel, r) => (
          <div key={rowLabel} className="contents">
            <div className="text-muted-foreground pr-1 text-right font-medium whitespace-nowrap">
              {rowLabel}
            </div>
            {colLabels.map((_, c) => {
              const value = values[r]?.[c] ?? 0;
              return (
                <div
                  key={c}
                  className={`flex aspect-square items-center justify-center rounded-sm tabular-nums ${intensityClass(value, max)}`}
                >
                  {value > 0 ? value : ''}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
