import Link from 'next/link';

import {
  APPLICANT_EDITABLE_APPLICATION_STATUSES,
  APPLICATION_STATUS_BADGE_VARIANT,
  APPLICATION_STATUS_LABELS,
  POSITION_CARD_STAT_STATUSES,
  STATUS_BADGE_VARIANT_TO_DOT,
} from '@/lib/constants';
import { ACTION_ICONS, CONCEPT_ICONS } from '@/lib/icons';
import type {
  MyPositionApplication,
  PositionApplicationStats,
  PositionWithQuestions,
} from '@/lib/types';
import { cn, getPositionAvailability, markdownToPlainText } from '@/lib/utils';

import { PositionDateLine } from '@/components/features/position-date-line';
import {
  ApplicationStatusBadge,
  PositionStatusBadge,
} from '@/components/features/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Markdown } from '@/components/ui/markdown';

interface PositionCardProps {
  position: PositionWithQuestions;
  canManage?: boolean;
  isAuthenticated?: boolean;
  applicationStats?: PositionApplicationStats;
  myApplication?: MyPositionApplication;
}

interface PositionStatClusterProps {
  stats: PositionApplicationStats;
}

// Zero-count tiles are dimmed rather than hidden, so the cluster keeps a stable shape.
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
          const dotClass = STATUS_BADGE_VARIANT_TO_DOT[variant];

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

export function PositionCard({
  position,
  canManage = false,
  isAuthenticated = false,
  applicationStats,
  myApplication,
}: PositionCardProps) {
  const availability = getPositionAvailability(position);
  const isAccepting = availability === 'accepting';
  const isDraft = myApplication?.status === 'draft';
  const canContinueOrResubmit =
    myApplication &&
    APPLICANT_EDITABLE_APPLICATION_STATUSES.includes(
      myApplication.status as (typeof APPLICANT_EDITABLE_APPLICATION_STATUSES)[number],
    ) &&
    (isDraft || isAccepting);

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
          <CardHeader className="p-4 pb-3">
            <div
              className={cn(
                'flex flex-wrap items-center gap-2',
                !applicationStats && 'justify-between',
              )}
            >
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg leading-snug">
                  {position.title}
                </CardTitle>
                {myApplication && (
                  <ApplicationStatusBadge status={myApplication.status} />
                )}
              </div>
              <PositionStatusBadge position={position} />
            </div>
            <PositionDateLine position={position} className="mt-1" />
          </CardHeader>

          <CardContent
            className={cn(
              'px-4 pb-4',
              applicationStats && 'sm:flex sm:flex-1 sm:flex-col',
            )}
          >
            {markdownToPlainText(position.description) && (
              <div className="max-h-15 overflow-clip text-sm [overflow-wrap:anywhere]">
                <Markdown
                  variant="compact"
                  source={position.description}
                  className="[&_p]:line-clamp-3"
                />
              </div>
            )}

            {/* mt-auto ensures buttons always sit at the bottom of the left column */}
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
              {canManage ? (
                <>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/positions/${position.id}`}>
                      <ACTION_ICONS.goTo />
                      View Details
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/positions/${position.id}/edit`}>
                      <ACTION_ICONS.edit />
                      Edit
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/applications?positionId=${position.id}`}>
                      <CONCEPT_ICONS.application />
                      Applications
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  {myApplication ? (
                    canContinueOrResubmit ? (
                      <Button asChild size="sm">
                        <Link href={`/positions/${position.id}/apply`}>
                          <ACTION_ICONS.submit />
                          {isDraft ? 'Continue application' : 'Edit & resubmit'}
                        </Link>
                      </Button>
                    ) : (
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={`/my-applications/${myApplication.id}`}
                          aria-label={`View your application for ${position.title}`}
                        >
                          <ACTION_ICONS.goTo />
                          View application
                        </Link>
                      </Button>
                    )
                  ) : (
                    isAccepting && (
                      <Button asChild size="sm">
                        {isAuthenticated ? (
                          <Link href={`/positions/${position.id}/apply`}>
                            <ACTION_ICONS.submit />
                            Apply
                          </Link>
                        ) : (
                          <Link
                            href={`/login?redirectTo=/positions/${position.id}/apply`}
                          >
                            <ACTION_ICONS.submit />
                            Apply
                          </Link>
                        )}
                      </Button>
                    )
                  )}
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/positions/${position.id}`}>
                      <ACTION_ICONS.goTo />
                      View Details
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </div>

        {/* Right column — stat cluster; stacks below left column on mobile,
            sits beside it at sm+ in a two-column layout */}
        {applicationStats && (
          <div className="px-4 pb-4 sm:flex sm:shrink-0 sm:items-start sm:p-6 sm:pl-0">
            <PositionStatCluster stats={applicationStats} />
          </div>
        )}
      </div>
    </Card>
  );
}
