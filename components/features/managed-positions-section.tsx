import { Briefcase } from 'lucide-react';

import type { ManagedPosition, PositionApplicationStats } from '@/lib/types';
import { isPositionActive } from '@/lib/utils';

import { ArchivedPositionsCollapsible } from '@/components/features/archived-positions-collapsible';
import { PositionCard } from '@/components/features/position-card';
import { EmptyState } from '@/components/ui/empty-state';

interface ManagedPositionsSectionProps {
  positions: ManagedPosition[];
  statsByPosition: Map<string, PositionApplicationStats>;
}

// Server component — partitions the caller's managed positions into active and
// archived (via isPositionActive, the single source of truth shared with #360's
// edit freeze) and renders active cards up front with archived cards behind a
// collapsed disclosure. ManagedPosition values (updatedAt/_count) never cross
// into the client leaf — only rendered JSX (children) does.
export function ManagedPositionsSection({
  positions,
  statsByPosition,
}: ManagedPositionsSectionProps) {
  const active = positions.filter((p) => isPositionActive(p));
  const archived = positions.filter((p) => !isPositionActive(p));

  return (
    <section
      aria-labelledby="managed-positions-heading"
      className="flex flex-col gap-4"
    >
      <h2 id="managed-positions-heading" className="text-lg font-semibold">
        My Managed Positions
      </h2>

      {active.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No active positions"
          description="Every position you manage is archived — expand Archived below to see them."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {active.map((position) => (
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

      {archived.length > 0 && (
        <ArchivedPositionsCollapsible count={archived.length}>
          <div className="flex flex-col gap-4">
            {archived.map((position) => (
              <PositionCard
                key={position.id}
                position={position}
                canManage={true}
                isAuthenticated={true}
                applicationStats={statsByPosition.get(position.id)}
              />
            ))}
          </div>
        </ArchivedPositionsCollapsible>
      )}
    </section>
  );
}
