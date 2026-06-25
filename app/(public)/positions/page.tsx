import { getPositions } from '@/prisma/data/positions';

import { getOptionalUser } from '@/lib/auth/server';

import { PositionCard } from '@/components/features/position-card';
import { PositionCreateDialog } from '@/components/features/position-create-dialog';

export default async function PositionsPage() {
  const user = await getOptionalUser();
  const isAdmin = user?.isAdmin ?? false;
  const isAuthenticated = user !== null;
  const positions = await getPositions({ isAdmin: false, userId: user?.id ?? null });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isAdmin ? 'Positions' : 'Open Positions'}
        </h1>
        {isAdmin && <PositionCreateDialog />}
      </div>

      {positions.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          There are no{isAdmin ? '' : ' open'} positions at this time.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {positions.map((position) => (
            <PositionCard
              key={position.id}
              position={position}
              canManage={false}
              isAuthenticated={isAuthenticated}
            />
          ))}
        </div>
      )}
    </div>
  );
}
