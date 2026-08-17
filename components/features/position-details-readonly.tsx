import type { PositionStatus } from '@/prisma/client';

import { formatDate } from '@/lib/utils';

import { PositionStatusBadge } from '@/components/features/status-badge';

interface PositionDetailsReadonlyProps {
  position: {
    title: string;
    description: string;
    status: PositionStatus;
    opensAt: Date | null;
    closesAt: Date | null;
  };
}

export function PositionDetailsReadonly({
  position,
}: PositionDetailsReadonlyProps) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <dt className="text-muted-foreground text-xs">Title</dt>
        <dd className="text-sm font-medium">{position.title}</dd>
      </div>

      <div className="sm:col-span-2">
        <dt className="text-muted-foreground text-xs">Description</dt>
        <dd className="text-sm whitespace-pre-wrap">
          {position.description || (
            <span className="text-muted-foreground">No description</span>
          )}
        </dd>
      </div>

      <div>
        <dt className="text-muted-foreground text-xs">Status</dt>
        <dd className="mt-1">
          <PositionStatusBadge position={position} />
        </dd>
      </div>

      <div>
        <dt className="text-muted-foreground text-xs">Opens</dt>
        <dd className="text-sm">
          {position.opensAt ? (
            formatDate(position.opensAt)
          ) : (
            <span className="text-muted-foreground">Not set</span>
          )}
        </dd>
      </div>

      <div>
        <dt className="text-muted-foreground text-xs">Closes</dt>
        <dd className="text-sm">
          {position.closesAt ? (
            formatDate(position.closesAt)
          ) : (
            <span className="text-muted-foreground">Not set</span>
          )}
        </dd>
      </div>
    </dl>
  );
}
