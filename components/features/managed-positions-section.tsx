import type { ReactNode } from 'react';

import { CONCEPT_ICONS } from '@/lib/icons';
import type { ManagedPosition, PositionApplicationStats } from '@/lib/types';
import { isPositionActive } from '@/lib/utils';

import { ArchivedPositionsCollapsible } from '@/components/features/archived-positions-collapsible';
import { PositionCard } from '@/components/features/position-card';
import { EmptyState } from '@/components/ui/empty-state';

interface ManagedPositionsSectionProps {
  positions: ManagedPosition[];
  statsByPosition: Map<string, PositionApplicationStats>;
  emptyDescription?: string;
  emptyAction?: ReactNode;
}

// Server component — partitions the caller's managed positions into active and
// archived (via isPositionActive, the single source of truth shared with #360's
// edit freeze) and renders active cards up front with archived cards behind a
// collapsed disclosure. ManagedPosition values (updatedAt/_count) never cross
// into the client leaf — only rendered JSX (children) does.
export function ManagedPositionsSection({
  positions,
  statsByPosition,
  emptyDescription,
  emptyAction,
}: ManagedPositionsSectionProps) {
  const active = positions.filter((p) => isPositionActive(p));
  const archived = positions.filter((p) => !isPositionActive(p));
  const noManagedPositions = positions.length === 0;

  return (
    <section
      aria-labelledby="active-positions-heading"
      className="flex flex-col gap-4"
    >
      <h2
        id="active-positions-heading"
        className="flex items-center gap-2 text-lg font-semibold"
      >
        <CONCEPT_ICONS.position className="text-muted-foreground size-4" />
        Active
      </h2>

      {active.length === 0 ? (
        <EmptyState
          icon={CONCEPT_ICONS.position}
          title="No active positions"
          description={
            noManagedPositions
              ? (emptyDescription ?? 'Positions you manage appear here.')
              : 'Every position you manage is archived — expand Archived below to see them.'
          }
          action={noManagedPositions ? emptyAction : undefined}
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
