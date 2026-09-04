import { CONCEPT_ICONS } from '@/lib/icons';
import type { PositionWindow } from '@/lib/types';
import { cn, getPositionDateInfo } from '@/lib/utils';

import { LocalTime } from '@/components/ui/local-time';

interface PositionDateLineProps {
  position: PositionWindow;
  className?: string;
}

export function PositionDateLine({
  position,
  className,
}: PositionDateLineProps) {
  const dateInfo = getPositionDateInfo(position);
  if (!dateInfo) return null;

  const isCalm = dateInfo.emphasis === 'calm';

  return (
    <p
      className={cn(
        'flex items-center gap-1.5 text-sm',
        isCalm ? 'font-medium' : 'font-semibold',
        className,
      )}
    >
      <CONCEPT_ICONS.deadline
        className={cn('size-4 shrink-0', isCalm && 'text-muted-foreground')}
      />
      {dateInfo.label} <LocalTime date={dateInfo.date} precision="datetime" />
    </p>
  );
}
