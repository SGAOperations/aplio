import { type $Enums } from '@/prisma/client';

import {
  APPLICATION_STATUS_BADGE_VARIANT,
  APPLICATION_STATUS_LABELS,
} from '@/lib/constants';

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
