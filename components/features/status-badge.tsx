import { type $Enums } from '@/prisma/client';

import {
  APPLICATION_STATUS_BADGE_VARIANT,
  APPLICATION_STATUS_LABELS,
  AVAILABILITY_LABELS,
  AVAILABILITY_VARIANTS,
  DELETED_APPLICATION_LABEL,
  STATUS_LABELS,
  STATUS_VARIANTS,
} from '@/lib/constants';
import type { PositionWindow } from '@/lib/types';
import { getPositionAvailability } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';

interface ApplicationStatusBadgeProps {
  status: $Enums.ApplicationStatus;
  deletedAt?: Date | null;
}

export function ApplicationStatusBadge({
  status,
  deletedAt,
}: ApplicationStatusBadgeProps) {
  if (deletedAt)
    return <Badge variant="outline">{DELETED_APPLICATION_LABEL}</Badge>;

  return (
    <Badge variant={APPLICATION_STATUS_BADGE_VARIANT[status]}>
      {APPLICATION_STATUS_LABELS[status]}
    </Badge>
  );
}

interface PositionStatusBadgeProps {
  position: PositionWindow;
}

// Effective availability, so a date-closed 'open' position reads "Closed".
export function PositionStatusBadge({ position }: PositionStatusBadgeProps) {
  const availability = getPositionAvailability(position);
  const variant =
    availability === 'unavailable'
      ? STATUS_VARIANTS[position.status]
      : AVAILABILITY_VARIANTS[availability];
  const label =
    availability === 'unavailable'
      ? STATUS_LABELS[position.status]
      : AVAILABILITY_LABELS[availability];

  return <Badge variant={variant}>{label}</Badge>;
}
