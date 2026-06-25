import { getManagedPositionIds } from '@/prisma/data/managers';
import { getPositions } from '@/prisma/data/positions';
import { getCurrentUser } from '@/lib/auth/server';

import { PositionCard } from '@/components/features/position-card';
import { PositionCreateDialog } from '@/components/features/position-create-dialog';
import { PageHeader } from '@/components/layouts/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Briefcase } from 'lucide-react';

export default async function PositionsPage() {
  const user = await getCurrentUser();
  const positions = await getPositions({ isAdmin: user.isAdmin, userId: user.id });

  let managedIds: Set<string>;
  if (user.isAdmin) {
    managedIds = new Set(positions.map((p) => p.id));
  } else {
    managedIds = await getManagedPositionIds(user.id);
  }
  const canCreate = user.isAdmin || managedIds.size > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={canCreate ? 'Positions' : 'Open Positions'}
        description={
          canCreate
            ? 'Create, edit, and review applications for every position.'
            : 'Browse and apply to open positions.'
        }
        actions={canCreate ? <PositionCreateDialog /> : undefined}
      />
      {positions.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={canCreate ? 'No positions yet' : 'No open positions'}
          description={
            canCreate
              ? 'Create your first position to start accepting applications.'
              : 'There are no open positions right now. Check back soon.'
          }
          action={canCreate ? <PositionCreateDialog /> : undefined}
        />
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
          {positions.map((position) => (
            <PositionCard
              key={position.id}
              position={position}
              canManage={managedIds.has(position.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
