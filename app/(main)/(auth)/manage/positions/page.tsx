import type { Metadata } from 'next';

import { getPositionApplicationStats } from '@/prisma/data/applications';
import {
  getAdminPositions,
  getManagedPositions,
} from '@/prisma/data/positions';

import { requireManagerOrAdminOr404 } from '@/lib/auth/guards';
import type { PositionApplicationStats } from '@/lib/types';

import { ManagedPositionsSection } from '@/components/features/managed-positions-section';
import { PositionCreateDialog } from '@/components/features/position-create-dialog';
import { PageHeader } from '@/components/layouts/page-header';

export const metadata: Metadata = { title: 'Manage Positions' };

export default async function ManagePositionsPage() {
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
          actions={<PositionCreateDialog isAdmin={user.isAdmin} />}
        />
        <ManagedPositionsSection
          positions={positions}
          statsByPosition={statsByPosition}
          emptyDescription="Create your first position to start accepting applications."
          emptyAction={<PositionCreateDialog isAdmin={user.isAdmin} />}
        />
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
        title="Manage Positions"
        description="Track applications and edit the positions you manage."
        actions={<PositionCreateDialog isAdmin={user.isAdmin} />}
      />
      <ManagedPositionsSection
        positions={managedPositions}
        statsByPosition={statsByPosition}
        emptyDescription="Positions you manage appear here. Create one to start accepting applications."
        emptyAction={<PositionCreateDialog isAdmin={user.isAdmin} />}
      />
    </div>
  );
}
