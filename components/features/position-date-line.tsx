import { CONCEPT_ICONS } from '@/lib/icons';
import type { PositionWindow } from '@/lib/types';
import { cn, getPositionAvailability } from '@/lib/utils';

import { LocalTime } from '@/components/ui/local-time';

interface PositionDateLineProps {
  position: PositionWindow;
  className?: string;
}

export function PositionDateLine({
  position,
  className,
}: PositionDateLineProps) {
  const availability = getPositionAvailability(position);

  let label: string;
  let date: Date;
  if (availability === 'accepting' && position.closesAt) {
    label = 'Closes';
    date = position.closesAt;
  } else if (availability === 'upcoming' && position.opensAt) {
    label = 'Opens';
    date = position.opensAt;
  } else if (
    (availability === 'closed_by_date' || availability === 'unavailable') &&
    position.closesAt
  ) {
    label = 'Closed';
    date = position.closesAt;
  } else return null;

  const isPast = label === 'Closed';

  return (
    <p
      className={cn(
        'flex items-center gap-1.5 text-sm',
        isPast ? 'font-medium' : 'font-semibold',
        className,
      )}
    >
      <CONCEPT_ICONS.deadline
        className={cn('size-4 shrink-0', isPast && 'text-muted-foreground')}
      />
      {label} <LocalTime date={date} precision="datetime" />
    </p>
  );
}
