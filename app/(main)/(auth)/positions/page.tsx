import { getPositions } from '@/prisma/services/positions';

import { getCurrentUser } from '@/lib/auth/server';

import { PositionCard } from '@/components/features/position-card';
import { PositionCreateDialog } from '@/components/features/position-create-dialog';

export default async function PositionsPage() {
  const user = await getCurrentUser();
  const positions = await getPositions(user.isAdmin);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {user.isAdmin ? 'Positions' : 'Open Positions'}
        </h1>
        {user.isAdmin && <PositionCreateDialog />}
      </div>

      {positions.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          There are no{user.isAdmin ? '' : ' open'} positions at this time.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {positions.map((position) => (
            <PositionCard
              key={position.id}
              position={position}
              showAdminActions={user.isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
