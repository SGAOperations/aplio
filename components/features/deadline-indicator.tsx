import { CONCEPT_ICONS, STATE_ICONS } from '@/lib/icons';
import type { PositionWindow } from '@/lib/types';
import { cn, getDeadlineInfo } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';
import { LocalTime } from '@/components/ui/local-time';

interface DeadlineIndicatorProps {
  position: PositionWindow;
  now: Date;
  // Badges (soon/urgent/past) fire only when true — submitted rows and the
  // table's non-draft cells pass false so they read as plain context.
  emphasizeUrgency: boolean;
  variant?: 'full' | 'compact';
}

// No 'use client' — LocalTime is the only client leaf this renders.
export function DeadlineIndicator({
  position,
  now,
  emphasizeUrgency,
  variant = 'full',
}: DeadlineIndicatorProps) {
  const info = getDeadlineInfo(position, now);
  if (!info) return <span className="text-muted-foreground">—</span>;

  const mutedLine = (
    <span
      className={cn(
        'text-muted-foreground flex items-center gap-1.5',
        variant === 'full' ? 'text-sm' : 'text-xs',
      )}
    >
      {variant === 'full' && (
        <CONCEPT_ICONS.deadline className="size-4 shrink-0" />
      )}
      {info.label} <LocalTime date={info.date} precision="date" />
    </span>
  );

  switch (info.tier) {
    case 'upcoming':
    case 'distant':
      return mutedLine;

    case 'soon':
      if (!emphasizeUrgency) return mutedLine;
      return (
        <Badge variant="warning">
          <STATE_ICONS.warning />
          <LocalTime date={info.date} precision="date">
            {variant === 'compact'
              ? `${info.compactCountdown} left`
              : `${info.label} ${info.countdown}`}
          </LocalTime>
        </Badge>
      );

    case 'urgent':
      if (!emphasizeUrgency) return mutedLine;
      return (
        <Badge variant="destructive">
          <STATE_ICONS.warning />
          <LocalTime date={info.date} precision="date">
            {variant === 'compact'
              ? `${info.compactCountdown} left`
              : `${info.label} ${info.countdown}`}
          </LocalTime>
        </Badge>
      );

    case 'past':
      if (!emphasizeUrgency) return mutedLine;
      return (
        <Badge variant="destructive">
          <STATE_ICONS.warning />
          {info.label} <LocalTime date={info.date} precision="date" />
        </Badge>
      );

    default: {
      const exhaustive: never = info.tier;
      return exhaustive;
    }
  }
}
