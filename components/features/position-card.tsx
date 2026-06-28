import Link from 'next/link';

import { Inbox, Pencil } from 'lucide-react';

import {
  APPLICATION_STATUS_BADGE_VARIANT,
  APPLICATION_STATUS_LABELS,
  POSITION_CARD_STAT_STATUSES,
  STATUS_BADGE_VARIANT_TO_DOT,
} from '@/lib/constants';
import type {
  PositionApplicationStats,
  PositionWithQuestions,
} from '@/lib/types';
import { cn, formatDate, getPositionAvailability } from '@/lib/utils';

import { PositionStatusBadge } from '@/components/features/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PositionCardProps {
  position: PositionWithQuestions;
  canManage?: boolean;
  isAuthenticated?: boolean;
  applicationStats?: PositionApplicationStats;
}

interface PositionStatClusterProps {
  stats: PositionApplicationStats;
}

// Co-located server sub-component — compact count+label tiles for managed position cards.
// Renders a "Total" lead tile and a 2x2 grid of the four key pipeline statuses.
// Zero-count tiles are dimmed rather than hidden so the cluster shape is stable.
function PositionStatCluster({ stats }: PositionStatClusterProps) {
  return (
    <div role="region" aria-label="Application stats" className="shrink-0">
      {/* Total tile — col-span-2 lead row with hairline divider below */}
      <div className="border-border mb-2 border-b pb-2">
        <div className="flex items-center gap-1.5">
          <span
            className="bg-primary size-2 shrink-0 rounded-full"
            aria-hidden="true"
          />
          <p className="text-muted-foreground text-[11px] leading-tight">
            Total
          </p>
        </div>
        <p className="mt-1 text-xl leading-none font-semibold tabular-nums">
          {stats.total}
        </p>
      </div>

      {/* 2x2 grid of key pipeline statuses */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {POSITION_CARD_STAT_STATUSES.map((status) => {
          const count = stats.counts[status] ?? 0;
          const isDimmed = count === 0;
          const variant = APPLICATION_STATUS_BADGE_VARIANT[status];
          const dotClass =
            STATUS_BADGE_VARIANT_TO_DOT[variant] ?? 'bg-muted-foreground';

          return (
            <div key={status}>
              <div className="flex items-center gap-1.5">
                <span
                  className={`size-1.5 shrink-0 rounded-full ${dotClass} ${isDimmed ? 'opacity-40' : ''}`}
                  aria-hidden="true"
                />
                <p
                  className={`text-[11px] leading-tight ${isDimmed ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}
                >
                  {APPLICATION_STATUS_LABELS[status]}
                </p>
              </div>
              <p
                className={`mt-0.5 text-xl leading-none font-semibold tabular-nums ${isDimmed ? 'text-muted-foreground/60' : ''}`}
              >
                {count}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Server component — flat summary card with always-visible truncated description
// and a CTA row linking into the detail page. Managed cards (canManage=true) also
// show a top-right-anchored application stats cluster when applicationStats is passed.
export function PositionCard({
  position,
  canManage = false,
  isAuthenticated = false,
  applicationStats,
}: PositionCardProps) {
  const availability = getPositionAvailability(position);
  const isAccepting = availability === 'accepting';

  let dateLabel: string | null = null;
  if (availability === 'accepting' && position.closesAt)
    dateLabel = `Closes ${formatDate(position.closesAt)}`;
  else if (availability === 'upcoming' && position.opensAt)
    dateLabel = `Opens ${formatDate(position.opensAt)}`;
  else if (
    (availability === 'closed_by_date' || availability === 'unavailable') &&
    position.closesAt
  )
    dateLabel = `Closed ${formatDate(position.closesAt)}`;

  return (
    <Card className="flex flex-col gap-0 p-0">
      {/* Two-column layout: when applicationStats is present the outer div becomes a
          flex row at sm+, with CardHeader + CardContent in the left column and the
          stat cluster in a right column that reaches the card's top edge.
          One-column view (no applicationStats): wrapper and column divs add no classes,
          card renders exactly as before. */}
      <div className={cn(applicationStats && 'sm:flex sm:flex-row')}>
        {/* Left column — header + content stacked; grows to fill available width */}
        <div
          className={cn(
            applicationStats && 'sm:flex sm:min-w-0 sm:flex-1 sm:flex-col',
          )}
        >
          <CardHeader className="p-4 pb-2">
            <div
              className={cn(
                'flex items-center gap-2',
                !applicationStats && 'justify-between',
              )}
            >
              <CardTitle className="text-lg leading-snug">
                {position.title}
              </CardTitle>
              <PositionStatusBadge position={position} />
            </div>
          </CardHeader>

          <CardContent
            className={cn(
              'px-4 pb-4',
              applicationStats && 'sm:flex sm:flex-1 sm:flex-col',
            )}
          >
            <p className="text-muted-foreground line-clamp-2 text-sm">
              {position.description}
            </p>
            {dateLabel && (
              <p className="text-muted-foreground mt-1 text-xs">{dateLabel}</p>
            )}

            {/* mt-auto ensures buttons always sit at the bottom of the left column */}
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
              {canManage ? (
                <>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/positions/${position.id}`}>View Details</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/positions/${position.id}/edit`}>
                      <Pencil className="size-4" />
                      Edit
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/applications?positionId=${position.id}`}>
                      <Inbox className="size-4" />
                      Applications
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  {isAccepting && (
                    <Button asChild size="sm">
                      {isAuthenticated ? (
                        <Link href={`/positions/${position.id}/apply`}>
                          Apply
                        </Link>
                      ) : (
                        <Link
                          href={`/login?redirectTo=/positions/${position.id}/apply`}
                        >
                          Apply
                        </Link>
                      )}
                    </Button>
                  )}
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/positions/${position.id}`}>View Details</Link>
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </div>

        {/* Right column — stat cluster top-aligned beside the full left column;
            hidden on mobile so stats only appear in the wide two-column layout */}
        {applicationStats && (
          <div className="hidden sm:flex sm:shrink-0 sm:items-start sm:p-6 sm:pl-0">
            <PositionStatCluster stats={applicationStats} />
          </div>
        )}
      </div>
    </Card>
  );
}
