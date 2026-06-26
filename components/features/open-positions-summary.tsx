import Link from 'next/link';

import { ArrowRight, Briefcase } from 'lucide-react';

import { getOpenPositionsSummary } from '@/prisma/data/positions';

import { type OpenPositionSummaryItem } from '@/lib/types';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface OpenPositionsSummaryProps {
  take?: number;
}

export async function OpenPositionsSummary({
  take = 3,
}: OpenPositionsSummaryProps) {
  const positions = await getOpenPositionsSummary(take);

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
        {positions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Briefcase
              className="text-muted-foreground size-10"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium">No open positions</p>
              <p className="text-muted-foreground mt-0.5 text-sm">
                Create a position to start accepting applications.
              </p>
            </div>
            <Link
              href="/positions"
              className="text-primary text-sm font-medium hover:underline"
            >
              Manage positions
            </Link>
          </div>
        ) : (
          <ul className="divide-y">
            {positions.map((position) => (
              <PositionRow key={position.id} position={position} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function PositionRow({ position }: { position: OpenPositionSummaryItem }) {
  const count = position._count.applications;
  const applicantLabel = `${count} ${count === 1 ? 'applicant' : 'applicants'}`;

  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3">
      <Link href="/positions" className="text-sm font-medium hover:underline">
        {position.title}
      </Link>
      <span className="text-muted-foreground shrink-0 text-sm">
        {applicantLabel}
      </span>
    </li>
  );
}
