import { cn } from '@/lib/utils';

const PROGRESS_RING_SIZE = { sm: 'size-4', md: 'size-5' } as const;

interface ProgressRingProps {
  percent: number;
  size?: keyof typeof PROGRESS_RING_SIZE;
  className?: string;
}

/** Server-only — no hooks, no animation. `role="img"` gives the ring one accessible name, so colour alone never carries meaning. */
export function ProgressRing({
  percent,
  size = 'md',
  className,
}: ProgressRingProps) {
  return (
    <span
      role="img"
      aria-label={`${percent}% complete`}
      className={cn('inline-flex shrink-0 items-center gap-1.5', className)}
    >
      <svg
        viewBox="0 0 36 36"
        className={PROGRESS_RING_SIZE[size]}
        aria-hidden="true"
      >
        <circle
          cx={18}
          cy={18}
          r={15.9155}
          fill="none"
          strokeWidth={4}
          className="stroke-border"
        />
        {/* r makes the circumference exactly 100, so the offset is 100 - percent. */}
        <circle
          cx={18}
          cy={18}
          r={15.9155}
          fill="none"
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={100}
          strokeDashoffset={100 - percent}
          transform="rotate(-90 18 18)"
          className="stroke-primary"
        />
      </svg>
      <span className="text-muted-foreground text-xs tabular-nums">
        {percent}%
      </span>
    </span>
  );
}
