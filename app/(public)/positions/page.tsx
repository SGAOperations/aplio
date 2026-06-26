import { Briefcase } from 'lucide-react';

import { getPositions } from '@/prisma/data/positions';

import { getOptionalUser } from '@/lib/auth/server';

import { PositionCard } from '@/components/features/position-card';
import { PositionCreateDialog } from '@/components/features/position-create-dialog';
import { EmptyState } from '@/components/ui/empty-state';

export default async function PositionsPage() {
  const user = await getOptionalUser();
  const isAdmin = user?.isAdmin ?? false;
  const isAuthenticated = user !== null;
  const positions = await getPositions({ isAdmin, userId: user?.id ?? null });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isAdmin ? 'Positions' : 'Open Positions'}
        </h1>
        {isAdmin && <PositionCreateDialog />}
      </div>

      {positions.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={isAdmin ? 'No positions yet' : 'No open positions'}
          description={
            isAdmin
              ? 'Create your first position to start accepting applications.'
              : 'Check back later for open positions.'
          }
          action={isAdmin ? <PositionCreateDialog /> : undefined}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {positions.map((position) => (
            <PositionCard
              key={position.id}
              position={position}
              canManage={isAdmin}
              isAuthenticated={isAuthenticated}
            />
          ))}
        </div>
      )}
    </div>
  );
}
