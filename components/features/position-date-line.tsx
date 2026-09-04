import { CONCEPT_ICONS, STATE_ICONS } from '@/lib/icons';
import type { PositionDateInfo, PositionWindow } from '@/lib/types';
import { cn, getPositionDateInfo } from '@/lib/utils';

import { LocalTime } from '@/components/ui/local-time';

interface PositionDateLineProps {
  position: PositionWindow;
  className?: string;
}

const EMPHASIS_STYLES: Record<
  PositionDateInfo['emphasis'],
  { icon: typeof CONCEPT_ICONS.deadline; textClass: string; iconClass: string }
> = {
  calm: {
    icon: CONCEPT_ICONS.deadline,
    textClass: 'font-medium',
    iconClass: 'text-muted-foreground',
  },
  live: {
    icon: CONCEPT_ICONS.deadline,
    textClass: 'font-semibold',
    iconClass: '',
  },
  stale: {
    icon: STATE_ICONS.warning,
    textClass: 'font-semibold',
    iconClass: 'text-warning',
  },
};

export function PositionDateLine({
  position,
  className,
}: PositionDateLineProps) {
  const dateInfo = getPositionDateInfo(position);
  if (!dateInfo) return null;

  const {
    icon: Icon,
    textClass,
    iconClass,
  } = EMPHASIS_STYLES[dateInfo.emphasis];

  return (
    <p
      className={cn('flex items-center gap-1.5 text-sm', textClass, className)}
    >
      <Icon className={cn('size-4 shrink-0', iconClass)} />
      {dateInfo.label} <LocalTime date={dateInfo.date} precision="datetime" />
    </p>
  );
}
