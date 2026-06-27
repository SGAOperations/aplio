import Link from 'next/link';

import { Inbox, Pencil } from 'lucide-react';

import type { PositionWithQuestions } from '@/lib/types';
import { formatDate, getPositionAvailability } from '@/lib/utils';

import { PositionStatusBadge } from '@/components/features/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PositionCardProps {
  position: PositionWithQuestions;
  canManage?: boolean;
  isAuthenticated?: boolean;
}

// Server component — accordion removed; flat summary card with always-visible
// truncated description and a CTA row linking into the detail page.
export function PositionCard({
  position,
  canManage = false,
  isAuthenticated = false,
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
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg leading-snug">
            {position.title}
          </CardTitle>
          <PositionStatusBadge position={position} />
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 px-4 pb-4">
        <p className="text-muted-foreground line-clamp-2 text-sm">
          {position.description}
        </p>

        {dateLabel && (
          <p className="text-muted-foreground text-xs">{dateLabel}</p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
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
                    <Link href={`/positions/${position.id}/apply`}>Apply</Link>
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
    </Card>
  );
}
