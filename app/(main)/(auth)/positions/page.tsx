import { Briefcase } from 'lucide-react';

import { getPositions } from '@/prisma/data/positions';

import { getCurrentUser } from '@/lib/auth/server';

import { PositionCard } from '@/components/features/position-card';
import { PositionCreateDialog } from '@/components/features/position-create-dialog';
import { PageHeader } from '@/components/layouts/page-header';
import { EmptyState } from '@/components/ui/empty-state';

export default async function PositionsPage() {
  const user = await getCurrentUser();
  const positions = await getPositions(user.isAdmin);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={user.isAdmin ? 'Positions' : 'Open Positions'}
        description={
          user.isAdmin
            ? 'Create, edit, and review applications for every position.'
            : 'Browse and apply to open positions.'
        }
        actions={user.isAdmin ? <PositionCreateDialog /> : undefined}
      />

      {positions.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={user.isAdmin ? 'No positions yet' : 'No open positions'}
          description={
            user.isAdmin
              ? 'Create your first position to start accepting applications.'
              : 'There are no open positions right now. Check back soon.'
          }
          action={user.isAdmin ? <PositionCreateDialog /> : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
