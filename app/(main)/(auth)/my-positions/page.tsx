import type { Metadata } from 'next';

import { Briefcase } from 'lucide-react';

import { getPositionApplicationStats } from '@/prisma/data/applications';
import {
  getAdminPositions,
  getManagedPositions,
} from '@/prisma/data/positions';

import { requireManagerOrAdminOr404 } from '@/lib/auth/guards';
import type { PositionApplicationStats } from '@/lib/types';

import { ManagedPositionsSection } from '@/components/features/managed-positions-section';
import { PositionCard } from '@/components/features/position-card';
import { PositionCreateDialog } from '@/components/features/position-create-dialog';
import { PageHeader } from '@/components/layouts/page-header';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'My Positions' };

export default async function MyPositionsPage() {
  // The (auth) layout only gates profile completeness, so this gates the role.
  const user = await requireManagerOrAdminOr404();

  if (user.isAdmin) {
    const positions = await getAdminPositions();
    const statsByPosition =
      positions.length > 0
        ? await getPositionApplicationStats(positions.map((p) => p.id))
        : new Map<string, PositionApplicationStats>();

    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="All Positions"
          description="Every position, with its application stats."
          actions={<PositionCreateDialog />}
        />
        {positions.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No positions yet"
            description="Create your first position to start accepting applications."
            action={<PositionCreateDialog />}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {positions.map((position) => (
              <PositionCard
                key={position.id}
                position={position}
                canManage={true}
                isAuthenticated={true}
                applicationStats={statsByPosition.get(position.id)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const managedPositions = await getManagedPositions(user.id);
  const statsByPosition =
    managedPositions.length > 0
      ? await getPositionApplicationStats(managedPositions.map((p) => p.id))
      : new Map<string, PositionApplicationStats>();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My Positions"
        description="Track applications and edit the positions you manage."
        actions={<PositionCreateDialog />}
      />
      <ManagedPositionsSection
        positions={managedPositions}
        statsByPosition={statsByPosition}
        emptyDescription="Positions you manage appear here. Closed positions drop off 30 days after they close once no applications are pending."
        emptyAction={<PositionCreateDialog />}
      />
    </div>
  );
}
