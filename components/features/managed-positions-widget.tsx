import Link from 'next/link';

import { getManagedPositionsSummary } from '@/prisma/data/positions';

import { CONCEPT_ICONS } from '@/lib/icons';

import { PositionStatusBadge } from '@/components/features/status-badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { SectionCard, SectionCardEmpty } from '@/components/ui/section-card';
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
    <SectionCard
      title="My Positions"
      icon={CONCEPT_ICONS.position}
      link={{
        href: '/manage/positions',
        label: 'See all',
        ariaLabel: 'See all positions',
      }}
    >
      {positions.length === 0 ? (
        <SectionCardEmpty
          icon={CONCEPT_ICONS.position}
          title="No positions yet"
          description="Positions you manage will appear here."
        />
      ) : (
        <ul className="divide-y">
          {positions.map((position) => (
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
              <PositionStatusBadge position={position} />
              <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                {position._count.applications}{' '}
                {position._count.applications === 1
                  ? 'applicant'
                  : 'applicants'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
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
