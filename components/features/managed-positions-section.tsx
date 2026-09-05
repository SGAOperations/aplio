import type { ReactNode } from 'react';

import { CONCEPT_ICONS } from '@/lib/icons';
import type { ManagedPosition, PositionApplicationStats } from '@/lib/types';
import { groupManagedPositions, isPositionActive } from '@/lib/utils';

import { ArchivedPositionsCollapsible } from '@/components/features/archived-positions-collapsible';
import { PositionCard } from '@/components/features/position-card';
import { EmptyState } from '@/components/ui/empty-state';

interface ManagedPositionsSectionProps {
  positions: ManagedPosition[];
  statsByPosition: Map<string, PositionApplicationStats>;
  emptyDescription?: string;
  emptyAction?: ReactNode;
}

interface PositionGroupProps {
  headingId: string;
  title: string;
  positions: ManagedPosition[];
  statsByPosition: Map<string, PositionApplicationStats>;
  trailing?: ReactNode;
}

function PositionGroup({
  headingId,
  title,
  positions,
  statsByPosition,
  trailing,
}: PositionGroupProps) {
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h3 id={headingId} className="text-sm font-medium">
        {title}
      </h3>
      {positions.length > 0 && (
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
      {trailing}
    </section>
  );
}

// Groups by availability (lib/utils.ts); Closed nests the isPositionActive active/archived split.
export function ManagedPositionsSection({
  positions,
  statsByPosition,
  emptyDescription,
  emptyAction,
}: ManagedPositionsSectionProps) {
  if (positions.length === 0)
    return (
      <section
        aria-labelledby="managed-positions-heading"
        className="flex flex-col gap-4"
      >
        <h2
          id="managed-positions-heading"
          className="flex items-center gap-2 text-lg font-semibold"
        >
          <CONCEPT_ICONS.position className="text-muted-foreground size-4" />
          My Managed Positions
        </h2>
        <EmptyState
          icon={CONCEPT_ICONS.position}
          title="No positions yet"
          description={emptyDescription ?? 'Positions you manage appear here.'}
          action={emptyAction}
        />
      </section>
    );

  const { open, closed, draft } = groupManagedPositions(positions);
  const closedActive = closed.filter((p) => isPositionActive(p));
  const closedArchived = closed.filter((p) => !isPositionActive(p));

  return (
    <section
      aria-labelledby="managed-positions-heading"
      className="flex flex-col gap-6"
    >
      <h2
        id="managed-positions-heading"
        className="flex items-center gap-2 text-lg font-semibold"
      >
        <CONCEPT_ICONS.position className="text-muted-foreground size-4" />
        My Managed Positions
      </h2>

      {open.length > 0 && (
        <PositionGroup
          headingId="managed-positions-open-heading"
          title="Open"
          positions={open}
          statsByPosition={statsByPosition}
        />
      )}

      {closed.length > 0 && (
        <PositionGroup
          headingId="managed-positions-closed-heading"
          title="Closed"
          positions={closedActive}
          statsByPosition={statsByPosition}
          trailing={
            <>
              {closedActive.length === 0 && (
                <p className="text-muted-foreground text-xs">
                  Nothing closed recently — expand Archived below to see older
                  positions.
                </p>
              )}
              {closedArchived.length > 0 && (
                <ArchivedPositionsCollapsible count={closedArchived.length}>
                  <div className="flex flex-col gap-4">
                    {closedArchived.map((position) => (
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
            </>
          }
        />
      )}

      {draft.length > 0 && (
        <PositionGroup
          headingId="managed-positions-draft-heading"
          title="Draft"
          positions={draft}
          statsByPosition={statsByPosition}
        />
      )}
    </section>
  );
}
