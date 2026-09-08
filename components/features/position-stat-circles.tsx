'use client';

import {
  POSITION_STAT_BUCKETS,
  STATUS_BADGE_VARIANT_TO_FILL,
} from '@/lib/constants';
import type { PositionApplicationStats } from '@/lib/types';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PositionStatCirclesProps {
  stats: PositionApplicationStats;
}

// Zero-count circles are dimmed rather than hidden, so the grid keeps a stable shape.
export function PositionStatCircles({ stats }: PositionStatCirclesProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div
        role="region"
        aria-label="Application stats"
        className="w-fit shrink-0"
      >
        <div className="grid grid-cols-2 justify-items-center gap-3">
          {POSITION_STAT_BUCKETS.map((bucket) => {
            const count = bucket.statuses.reduce(
              (sum, status) => sum + (stats.counts[status] ?? 0),
              0,
            );
            const isDimmed = count === 0;

            return (
              <div key={bucket.key} className="flex flex-col items-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={`${bucket.label}: ${count}`}
                      className={`focus-visible:ring-ring/50 flex h-11 min-w-11 items-center justify-center rounded-full px-2.5 text-base font-semibold tabular-nums transition-transform duration-150 outline-none hover:scale-110 focus-visible:scale-110 focus-visible:ring-[3px] motion-reduce:transition-none ${isDimmed ? 'bg-muted text-foreground' : STATUS_BADGE_VARIANT_TO_FILL[bucket.variant]}`}
                    >
                      {count}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {bucket.label} — {count}
                  </TooltipContent>
                </Tooltip>
                <span
                  aria-hidden="true"
                  className="text-muted-foreground hidden text-[11px] leading-tight pointer-coarse:block"
                >
                  {bucket.label}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-muted-foreground mt-2 text-center text-xs">
          Total: <span className="tabular-nums">{stats.total}</span>
        </p>
      </div>
    </TooltipProvider>
  );
}
