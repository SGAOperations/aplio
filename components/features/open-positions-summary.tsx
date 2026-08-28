import Link from 'next/link';

import { getOpenPositionsSummary } from '@/prisma/data/positions';

import { CONCEPT_ICONS } from '@/lib/icons';
import { type OpenPositionSummaryItem } from '@/lib/types';

import { SectionCard, SectionCardEmpty } from '@/components/ui/section-card';

interface OpenPositionsSummaryProps {
  take?: number;
}

export async function OpenPositionsSummary({
  take = 3,
}: OpenPositionsSummaryProps) {
  const positions = await getOpenPositionsSummary(take);

  return (
    <SectionCard
      title="Open Positions"
      icon={CONCEPT_ICONS.position}
      link={{
        href: '/my-positions',
        label: 'See all',
        ariaLabel: 'See all positions',
      }}
    >
      {positions.length === 0 ? (
        <SectionCardEmpty
          icon={CONCEPT_ICONS.position}
          title="No open positions"
          description="Create a position to start accepting applications."
          action={
            <Link
              href="/my-positions"
              className="text-primary text-sm font-medium hover:underline"
            >
              Manage positions
            </Link>
          }
        />
      ) : (
        <ul className="divide-y">
          {positions.map((position) => (
            <PositionRow key={position.id} position={position} />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function PositionRow({ position }: { position: OpenPositionSummaryItem }) {
  const count = position._count.applications;
  const applicantLabel = `${count} ${count === 1 ? 'applicant' : 'applicants'}`;

  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3">
      <Link
        href={`/positions/${position.id}`}
        className="text-sm font-medium hover:underline"
      >
        {position.title}
      </Link>
      <span className="text-muted-foreground shrink-0 text-sm">
        {applicantLabel}
      </span>
    </li>
  );
}
