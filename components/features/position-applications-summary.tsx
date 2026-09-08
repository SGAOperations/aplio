import type { $Enums } from '@/prisma/client';

import {
  APPLICATION_PIPELINE_STATUSES,
  APPLICATION_STATUS_BADGE_VARIANT,
  APPLICATION_STATUS_LABELS,
  STATUS_BADGE_VARIANT_TO_DOT,
} from '@/lib/constants';
import { CONCEPT_ICONS } from '@/lib/icons';

import { StatCard } from '@/components/features/stat-card';
import { SectionCardEmpty } from '@/components/ui/section-card';

interface PositionApplicationsSummaryProps {
  counts: Partial<Record<$Enums.ApplicationStatus, number>>;
  total: number;
}

// getPositionApplicationStats is already fetched for this page to compute
// one number for a callout — this surfaces the full breakdown, nearly free.
export function PositionApplicationsSummary({
  counts,
  total,
}: PositionApplicationsSummaryProps) {
  if (total === 0)
    return (
      <SectionCardEmpty
        icon={CONCEPT_ICONS.application}
        title="No applications yet"
        description="Counts appear here once someone applies."
      />
    );

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
      <StatCard
        label="Total"
        value={total}
        dotClassName="bg-primary"
        className="col-span-2 md:col-span-1"
      />
      {APPLICATION_PIPELINE_STATUSES.map((status) => {
        const count = counts[status] ?? 0;
        const variant = APPLICATION_STATUS_BADGE_VARIANT[status];
        return (
          <StatCard
            key={status}
            label={APPLICATION_STATUS_LABELS[status]}
            value={count}
            dotClassName={STATUS_BADGE_VARIANT_TO_DOT[variant]}
          />
        );
      })}
    </div>
  );
}
