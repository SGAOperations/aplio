import { $Enums } from '@/prisma/client';
import { getApplicationStatusCounts } from '@/prisma/data/applications';

import {
  APPLICATION_STATUS_BADGE_VARIANT,
  APPLICATION_STATUS_LABELS,
  STATUS_BADGE_VARIANT_TO_DOT,
} from '@/lib/constants';

import { StatCard } from '@/components/features/stat-card';

// Statuses surfaced in the pipeline summary (excludes draft).
const PIPELINE_STATUSES = [
  $Enums.ApplicationStatus.applied,
  $Enums.ApplicationStatus.reached_out,
  $Enums.ApplicationStatus.interview_scheduled,
  $Enums.ApplicationStatus.reviewing,
  $Enums.ApplicationStatus.accepted,
  $Enums.ApplicationStatus.rejected,
] as const;

export async function PipelineSummary() {
  const counts = await getApplicationStatusCounts();

  const total = PIPELINE_STATUSES.reduce((sum, s) => sum + (counts[s] ?? 0), 0);

  return (
    <section aria-label="Pipeline summary">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
        {/* Leading "Total" card — sum of all non-draft pipeline statuses */}
        <StatCard label="Total" value={total} dotClassName="bg-primary" />

        {PIPELINE_STATUSES.map((status) => {
          const count = counts[status] ?? 0;
          const variant = APPLICATION_STATUS_BADGE_VARIANT[status];
          const dotClass =
            STATUS_BADGE_VARIANT_TO_DOT[variant] ?? 'bg-muted-foreground';

          return (
            <StatCard
              key={status}
              label={APPLICATION_STATUS_LABELS[status]}
              value={count}
              dotClassName={dotClass}
            />
          );
        })}
      </div>
    </section>
  );
}
