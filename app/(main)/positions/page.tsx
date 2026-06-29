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

import { PositionCard } from '@/components/features/position-card';
import { PositionCreateDialog } from '@/components/features/position-create-dialog';
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
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Positions</h1>
          <PositionCreateDialog />
        </div>
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

  // Fetch application stats for managed positions — stats are cross-user aggregates
  // safe to show to managers (see getPositionApplicationStats() for the invariant).
  const statsByPosition =
    managedIds.size > 0
      ? await getPositionApplicationStats([...managedIds])
      : new Map<string, PositionApplicationStats>();

  // Show "Positions I Manage" only when the user actually manages at least one
  // relevant position — non-managers get an empty array, so the section is omitted.
  const showManagedSection = managedPositions.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">Positions</h1>

      {/* My Positions — shown first for managers; omitted when empty (non-manager or no relevant positions) */}
      {showManagedSection && (
        <section
          aria-labelledby="my-positions-heading"
          className="flex flex-col gap-4"
        >
          <h2 id="my-positions-heading" className="text-lg font-semibold">
            My Positions
          </h2>
          <div className="flex flex-col gap-4">
            {managedPositions.map((position) => (
              <PositionCard
                key={position.id}
                position={position}
                canManage={true}
                isAuthenticated={isAuthenticated}
                applicationStats={statsByPosition.get(position.id)}
              />
            ))}
          </div>
        </section>
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
