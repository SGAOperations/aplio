import Link from 'next/link';

import { ArrowRight, Briefcase } from 'lucide-react';

import { getPositions } from '@/prisma/data/positions';

import { formatDate, getPositionAvailability } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface OpenPositionsWidgetProps {
  limit?: number;
}

export async function OpenPositionsWidget({
  limit = 3,
}: OpenPositionsWidgetProps) {
  // isAdmin:false + userId:null → open-only positions; does not surface a
  // manager's draft/closed positions in this "Open Positions" widget context.
  const positions = await getPositions({ isAdmin: false, userId: null });
  const displayed = positions.slice(0, limit);

  return (
    <Card className="gap-0 p-0">
      <CardHeader className="border-b p-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Open Positions
          </CardTitle>
          <Link
            href="/positions"
            aria-label="See all positions"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
          >
            See all
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Briefcase
              className="text-muted-foreground size-10"
              aria-hidden="true"
            />
            <p className="text-muted-foreground text-sm">
              No open positions right now.
            </p>
            <p className="text-muted-foreground text-xs">
              Check back soon for new opportunities.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {displayed.map((position) => {
              const availability = getPositionAvailability(position);
              const isAccepting = availability === 'accepting';
              return (
                <li key={position.id} className="flex flex-col gap-1.5 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {position.title}
                      </p>
                      {position.description && (
                        <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                          {position.description}
                        </p>
                      )}
                    </div>
                    {isAccepting ? (
                      <Button asChild size="sm" className="shrink-0">
                        <Link href={`/positions/${position.id}/apply`}>
                          Apply
                        </Link>
                      </Button>
                    ) : (
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {availability === 'upcoming' && position.opensAt
                          ? `Opens ${formatDate(position.opensAt)}`
                          : 'Closed'}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
