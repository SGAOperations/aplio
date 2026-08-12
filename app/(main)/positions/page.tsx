import type { Metadata } from 'next';

import { Briefcase } from 'lucide-react';

import { getPositionApplicationStats } from '@/prisma/data/applications';
import {
  getAdminPositions,
  getManagedPositions,
  getOpenPositions,
  getRecentlyClosedPositions,
} from '@/prisma/data/positions';

import { getOptionalUser } from '@/lib/auth/server';
import type { PositionApplicationStats } from '@/lib/types';

import { ManagedPositionsSection } from '@/components/features/managed-positions-section';
import { PositionCard } from '@/components/features/position-card';
import { PositionCreateDialog } from '@/components/features/position-create-dialog';
import { PageHeader } from '@/components/layouts/page-header';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Positions' };

export default async function PositionsPage() {
  const user = await getOptionalUser();
  const isAdmin = user?.isAdmin ?? false;

  // Admin branch: flat list with create action and application stats on every card.
  if (isAdmin) {
    const positions = await getAdminPositions();
    const adminStatsByPosition =
      positions.length > 0
        ? await getPositionApplicationStats(positions.map((p) => p.id))
        : new Map<string, PositionApplicationStats>();
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Positions"
          description="Create positions and track their applications."
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
                applicationStats={adminStatsByPosition.get(position.id)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isAuthenticated = user !== null;

  // Fetch open and recently-closed in parallel; fetch managed only when signed in.
  const [openPositions, recentlyClosed, managedPositions] = await Promise.all([
    getOpenPositions(),
    getRecentlyClosedPositions(),
    user ? getManagedPositions(user.id) : Promise.resolve([]),
  ]);

  // Build a set of managed IDs so canManage can be derived in O(1) per card.
  const managedIds = new Set(managedPositions.map((p) => p.id));

  // Aggregates only, so they are safe to show a manager.
  const statsByPosition =
    managedIds.size > 0
      ? await getPositionApplicationStats([...managedIds])
      : new Map<string, PositionApplicationStats>();

  // Empty for non-managers, which omits the section.
  const showManagedSection = managedPositions.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Positions"
        description="Browse open positions and apply."
      />

      {/* My Positions — shown first for managers; omitted when empty (non-manager or no relevant positions) */}
      {showManagedSection && (
        <ManagedPositionsSection
          positions={managedPositions}
          statsByPosition={statsByPosition}
        />
      )}

      {/* Open Positions — always rendered, even when empty */}
      <section
        aria-labelledby="open-positions-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="open-positions-heading" className="text-lg font-semibold">
          Open Positions
        </h2>
        {openPositions.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No open positions"
            description="Check back later for open positions."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {openPositions.map((position) => (
              <PositionCard
                key={position.id}
                position={position}
                canManage={managedIds.has(position.id)}
                isAuthenticated={isAuthenticated}
                applicationStats={
                  managedIds.has(position.id)
                    ? statsByPosition.get(position.id)
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* Recently Closed — omitted when empty (showing nothing is less noisy) */}
      {recentlyClosed.length > 0 && (
        <section
          aria-labelledby="recently-closed-heading"
          className="flex flex-col gap-4"
        >
          <h2 id="recently-closed-heading" className="text-lg font-semibold">
            Recently Closed
          </h2>
          <div className="flex flex-col gap-4">
            {recentlyClosed.map((position) => (
              <PositionCard
                key={position.id}
                position={position}
                canManage={managedIds.has(position.id)}
                isAuthenticated={isAuthenticated}
                applicationStats={
                  managedIds.has(position.id)
                    ? statsByPosition.get(position.id)
                    : undefined
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
