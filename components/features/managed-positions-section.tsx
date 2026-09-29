import type { ReactNode } from 'react';

import type { LucideIcon } from 'lucide-react';

import { CONCEPT_ICONS, POSITION_STATUS_ICONS } from '@/lib/icons';
import type { ManagedPosition, PositionApplicationStats } from '@/lib/types';
import {
  groupManagedPositions,
  isPositionActive,
  markdownToPlainText,
} from '@/lib/utils';

import { ArchivedPositionsCollapsible } from '@/components/features/archived-positions-collapsible';
import { PositionCard } from '@/components/features/position-card';
import {
  PositionSearchEmpty,
  PositionSearchGroup,
  PositionSearchItem,
  PositionSearchProvider,
  PositionSearchWhenIdle,
} from '@/components/features/position-search';
import { EmptyState } from '@/components/ui/empty-state';

interface ManagedPositionsSectionProps {
  positions: ManagedPosition[];
  statsByPosition: Map<string, PositionApplicationStats>;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  nestedUnder?: string;
  noProvider?: boolean;
}

interface PositionGroupProps {
  sectionId: string;
  headingId: string;
  title: string;
  icon: LucideIcon;
  positions: ManagedPosition[];
  statsByPosition: Map<string, PositionApplicationStats>;
  count: number;
  trailing?: ReactNode;
  nested?: boolean;
}

function PositionGroup({
  sectionId,
  headingId,
  title,
  icon: Icon,
  positions,
  statsByPosition,
  count,
  trailing,
  nested,
}: PositionGroupProps) {
  const Heading = nested ? 'h3' : 'h2';
  const ids = positions.map((p) => p.id);
  return (
    <section
      id={sectionId}
      {...(!nested && { 'data-section-nav': title })}
      aria-labelledby={headingId}
      className="flex scroll-mt-6 flex-col gap-4"
    >
      <Heading
        id={headingId}
        className={`flex items-center gap-2 font-semibold ${nested ? 'text-base' : 'text-lg'}`}
      >
        <Icon className="text-muted-foreground size-4" />
        {title}
        <span className="text-muted-foreground font-normal tabular-nums">
          ({count})
        </span>
      </Heading>
      {positions.length > 0 && (
        <PositionSearchGroup ids={ids}>
          <div className="flex flex-col gap-4">
            {positions.map((position) => (
              <PositionSearchItem
                key={position.id}
                id={position.id}
                title={position.title}
                description={markdownToPlainText(position.description)}
              >
                <PositionCard
                  position={position}
                  canManage={true}
                  isAuthenticated={true}
                  applicationStats={statsByPosition.get(position.id)}
                />
              </PositionSearchItem>
            ))}
          </div>
        </PositionSearchGroup>
      )}
      {trailing}
    </section>
  );
}

// Groups by availability (lib/utils.ts); Archived is nested inside Closed's trailing.
export function ManagedPositionsSection({
  positions,
  statsByPosition,
  emptyDescription,
  emptyAction,
  nestedUnder,
  noProvider,
}: ManagedPositionsSectionProps) {
  if (positions.length === 0)
    return (
      <EmptyState
        icon={CONCEPT_ICONS.position}
        title="No positions yet"
        description={emptyDescription ?? 'Positions you manage appear here.'}
        action={emptyAction}
      />
    );

  const { open, closed, draft } = groupManagedPositions(positions);
  const closedActive = closed.filter((p) => isPositionActive(p));
  const closedArchived = closed.filter((p) => !isPositionActive(p));
  const prefix = nestedUnder ? `${nestedUnder}-` : '';
  const nested = Boolean(nestedUnder);

  const hasClosed = closedActive.length > 0 || closedArchived.length > 0;
  const closedAllIds = [...closedActive, ...closedArchived].map((p) => p.id);

  const content = (
    <div className="flex flex-col gap-6">
      {open.length > 0 && (
        <PositionSearchGroup ids={open.map((p) => p.id)}>
          <PositionGroup
            sectionId={`${prefix}open`}
            headingId={`${prefix}open-heading`}
            title="Open"
            icon={POSITION_STATUS_ICONS.open}
            positions={open}
            statsByPosition={statsByPosition}
            count={open.length}
            nested={nested}
          />
        </PositionSearchGroup>
      )}

      {hasClosed && (
        <PositionSearchGroup ids={closedAllIds}>
          <PositionGroup
            sectionId={`${prefix}closed`}
            headingId={`${prefix}closed-heading`}
            title="Closed"
            icon={POSITION_STATUS_ICONS.closed}
            positions={closedActive}
            statsByPosition={statsByPosition}
            count={closed.length}
            nested={nested}
            trailing={
              closedArchived.length > 0 ? (
                <>
                  {closedActive.length === 0 && (
                    <PositionSearchWhenIdle>
                      <p className="text-muted-foreground text-sm">
                        Nothing closed recently — expand Archived below to see
                        older positions.
                      </p>
                    </PositionSearchWhenIdle>
                  )}
                  <ArchivedPositionsCollapsible
                    ids={closedArchived.map((p) => p.id)}
                  >
                    <div className="flex flex-col gap-4">
                      {closedArchived.map((position) => (
                        <PositionSearchItem
                          key={position.id}
                          id={position.id}
                          title={position.title}
                          description={markdownToPlainText(
                            position.description,
                          )}
                        >
                          <PositionCard
                            position={position}
                            canManage={true}
                            isAuthenticated={true}
                            applicationStats={statsByPosition.get(position.id)}
                          />
                        </PositionSearchItem>
                      ))}
                    </div>
                  </ArchivedPositionsCollapsible>
                </>
              ) : undefined
            }
          />
        </PositionSearchGroup>
      )}

      {draft.length > 0 && (
        <PositionSearchGroup ids={draft.map((p) => p.id)}>
          <PositionGroup
            sectionId={`${prefix}draft`}
            headingId={`${prefix}draft-heading`}
            title="Draft"
            icon={POSITION_STATUS_ICONS.draft}
            positions={draft}
            statsByPosition={statsByPosition}
            count={draft.length}
            nested={nested}
          />
        </PositionSearchGroup>
      )}

      <PositionSearchEmpty />
    </div>
  );

  if (noProvider) return content;

  const searchItems = positions.map((p) => ({
    id: p.id,
    title: p.title,
    description: markdownToPlainText(p.description),
  }));

  return (
    <PositionSearchProvider items={searchItems}>
      {content}
    </PositionSearchProvider>
  );
}
