'use client';

import { POSITION_STAT_BUCKETS } from '@/lib/constants';
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

// Zero-count circles are dimmed rather than hidden, so the row keeps a stable shape.
export function PositionStatCircles({ stats }: PositionStatCirclesProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div
        role="region"
        aria-label="Application stats"
        className="w-fit shrink-0"
      >
        <div className="flex justify-center gap-1.5">
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
                      className="group focus-visible:ring-ring/50 relative flex min-h-11 min-w-11 items-center justify-center outline-none hover:z-10 focus-visible:z-10 focus-visible:ring-[3px]"
                    >
                      <span
                        className={`flex size-7 items-center justify-center rounded-full border-2 text-xs font-semibold tabular-nums transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-110 group-focus-visible:scale-110 motion-reduce:transition-none ${isDimmed ? 'border-border text-muted-foreground' : `${bucket.ringClassName} text-foreground`}`}
                      >
                        {count}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {bucket.label} — {count}
                  </TooltipContent>
                </Tooltip>
                <span
                  aria-hidden="true"
                  className="text-muted-foreground hidden max-w-11 text-center text-[10px] leading-tight break-words pointer-coarse:block"
                >
                  {bucket.label}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-muted-foreground mt-1 text-center text-[11px]">
          Total: <span className="tabular-nums">{stats.total}</span>
        </p>
      </div>
    </TooltipProvider>
  );
}
