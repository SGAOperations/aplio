import Link from 'next/link';

import { ArrowRight, Briefcase } from 'lucide-react';

import { getManagedPositionsSummary } from '@/prisma/data/positions';

import { AVAILABILITY_LABELS, AVAILABILITY_VARIANTS } from '@/lib/constants';
import { getPositionAvailability } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ManagedPositionsWidgetProps {
  userId: string;
  take?: number;
}

export async function ManagedPositionsWidget({
  userId,
  take = 3,
}: ManagedPositionsWidgetProps) {
  const positions = await getManagedPositionsSummary(userId, take);

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <CardHeader className="border-b p-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            My Positions
          </CardTitle>
          <Link
            href="/my-positions"
            aria-label="See all positions"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
          >
            See all
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {positions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Briefcase
              className="text-muted-foreground size-10"
              aria-hidden="true"
            />
            <p className="text-sm font-medium">No positions yet</p>
            <p className="text-muted-foreground text-sm">
              Positions you manage will appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {positions.map((position) => {
              const availability = getPositionAvailability(position);
              return (
                <li
                  key={position.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3"
                >
                  <Link
                    href={`/positions/${position.id}`}
                    className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                  >
                    {position.title}
                  </Link>
                  <Badge variant={AVAILABILITY_VARIANTS[availability]}>
                    {AVAILABILITY_LABELS[availability]}
                  </Badge>
                  <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                    {position._count.applications}{' '}
                    {position._count.applications === 1
                      ? 'applicant'
                      : 'applicants'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function ManagedPositionsWidgetSkeleton() {
  return (
    <Card className="gap-0 p-0">
      <CardHeader className="border-b p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b px-4 py-3 last:border-0"
          >
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-5 w-16 rounded-md" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
