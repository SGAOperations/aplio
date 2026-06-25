import { type $Enums } from '@/prisma/client';

import {
  APPLICATION_STATUS_BADGE_VARIANT,
  APPLICATION_STATUS_LABELS,
  AVAILABILITY_LABELS,
  AVAILABILITY_VARIANTS,
  STATUS_LABELS,
  STATUS_VARIANTS,
} from '@/lib/constants';
import type { PositionWindow } from '@/lib/types';
import { getPositionAvailability } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';

interface ApplicationStatusBadgeProps {
  status: $Enums.ApplicationStatus;
}

export function ApplicationStatusBadge({
  status,
}: ApplicationStatusBadgeProps) {
  return (
    <Badge variant={APPLICATION_STATUS_BADGE_VARIANT[status]}>
      {APPLICATION_STATUS_LABELS[status]}
    </Badge>
  );
}

interface PositionStatusBadgeProps {
  position: PositionWindow;
}

// Renders the effective availability badge for a position, using the computed
// availability so a date-closed 'open' position shows "Closed" rather than "Open".
export function PositionStatusBadge({ position }: PositionStatusBadgeProps) {
  const availability = getPositionAvailability(position);
  const variant =
    availability === 'unavailable'
      ? (STATUS_VARIANTS[position.status] ?? 'outline')
      : AVAILABILITY_VARIANTS[availability];
  const label =
    availability === 'unavailable'
      ? (STATUS_LABELS[position.status] ?? position.status)
      : AVAILABILITY_LABELS[availability];

  return <Badge variant={variant}>{label}</Badge>;
}
