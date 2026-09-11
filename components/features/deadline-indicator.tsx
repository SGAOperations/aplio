import type { ReactNode } from 'react';

import { DEADLINE_TIER_ICONS, STATE_ICONS } from '@/lib/icons';
import type { PositionWindow } from '@/lib/types';
import { cn, getDeadlineInfo } from '@/lib/utils';

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

  const isPast = info.tier === 'past';
  const Icon = DEADLINE_TIER_ICONS[info.tier];

  const mutedLine = (
    <span
      className={cn(
        'text-muted-foreground flex items-center gap-1.5',
        variant === 'full' ? 'text-sm' : 'text-xs',
        isPast && 'opacity-70',
      )}
    >
      {variant === 'full' && <Icon className="size-4 shrink-0" />}
      {info.label}
      {isPast ? ' · ' : ' '}
      <LocalTime date={info.date} precision="date" />
    </span>
  );

  // Text, not a Badge — a filled pill next to the status badge reads heavier
  // than a metadata line should; text-warning-text/destructive-text pass
  // AA at 12px/14px, unlike --warning/--destructive used as plain text.
  const emphasizedLine = (
    tone: 'warning' | 'destructive',
    children: ReactNode,
  ) => (
    <span
      className={cn(
        'flex items-center gap-1.5 font-semibold',
        variant === 'full' ? 'text-sm' : 'text-xs',
        tone === 'warning' ? 'text-warning-text' : 'text-destructive-text',
      )}
    >
      <STATE_ICONS.warning className="size-4 shrink-0" />
      {children}
    </span>
  );

  switch (info.tier) {
    case 'upcoming':
    case 'distant':
      return mutedLine;

    case 'soon':
      if (!emphasizeUrgency) return mutedLine;
      return emphasizedLine(
        'warning',
        <LocalTime date={info.date} precision="date">
          {variant === 'compact'
            ? `${info.compactCountdown} left`
            : `${info.label} ${info.countdown}`}
        </LocalTime>,
      );

    case 'urgent':
      if (!emphasizeUrgency) return mutedLine;
      return emphasizedLine(
        'destructive',
        <LocalTime date={info.date} precision="date">
          {variant === 'compact'
            ? `${info.compactCountdown} left`
            : `${info.label} ${info.countdown}`}
        </LocalTime>,
      );

    case 'past':
      if (!emphasizeUrgency) return mutedLine;
      return emphasizedLine(
        'destructive',
        <>
          {info.label} <LocalTime date={info.date} precision="date" />
        </>,
      );

    default: {
      const exhaustive: never = info.tier;
      return exhaustive;
    }
  }
}
