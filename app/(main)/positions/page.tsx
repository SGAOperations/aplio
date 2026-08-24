import type { Metadata } from 'next';

import { getMyApplicationsByPosition } from '@/prisma/data/applications';
import {
  getOpenPositions,
  getRecentlyClosedPositions,
} from '@/prisma/data/positions';

import { getOptionalUser, requireName } from '@/lib/auth/server';
import { CONCEPT_ICONS, STATE_ICONS } from '@/lib/icons';
import type { MyPositionApplication } from '@/lib/types';

import { PositionCard } from '@/components/features/position-card';
import { PageHeader } from '@/components/layouts/page-header';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Positions' };

export default async function PositionsPage() {
  const user = await getOptionalUser();
  if (user) await requireName(user);
  const isAuthenticated = user !== null;

  const [openPositions, recentlyClosed, myApplications] = await Promise.all([
    getOpenPositions(),
    getRecentlyClosedPositions(),
    user
      ? getMyApplicationsByPosition(user.id)
      : Promise.resolve(new Map<string, MyPositionApplication>()),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Positions"
        description="Browse open positions and apply."
      />

      {/* Open Positions — always rendered, even when empty */}
      <section
        aria-labelledby="open-positions-heading"
        className="flex flex-col gap-4"
      >
        <h2
          id="open-positions-heading"
          className="flex items-center gap-2 text-lg font-semibold"
        >
          <CONCEPT_ICONS.position className="text-muted-foreground size-4" />
          Open Positions
        </h2>
        {openPositions.length === 0 ? (
          <EmptyState
            icon={CONCEPT_ICONS.position}
            title="No open positions"
            description="Check back later for open positions."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {openPositions.map((position) => (
              <PositionCard
                key={position.id}
                position={position}
                isAuthenticated={isAuthenticated}
                myApplication={myApplications.get(position.id)}
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
          <h2
            id="recently-closed-heading"
            className="flex items-center gap-2 text-lg font-semibold"
          >
            <STATE_ICONS.archived className="text-muted-foreground size-4" />
            Recently Closed
          </h2>
          <div className="flex flex-col gap-4">
            {recentlyClosed.map((position) => (
              <PositionCard
                key={position.id}
                position={position}
                isAuthenticated={isAuthenticated}
                myApplication={myApplications.get(position.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
