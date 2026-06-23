import { $Enums } from '@/prisma/client';
import { getApplicationStatusCounts } from '@/prisma/data/applications';

import {
  APPLICATION_STATUS_BADGE_VARIANT,
  APPLICATION_STATUS_LABELS,
} from '@/lib/constants';

import { Card, CardContent } from '@/components/ui/card';

// Statuses surfaced in the pipeline summary (excludes draft).
const PIPELINE_STATUSES = [
  $Enums.ApplicationStatus.applied,
  $Enums.ApplicationStatus.reached_out,
  $Enums.ApplicationStatus.interview_scheduled,
  $Enums.ApplicationStatus.reviewing,
  $Enums.ApplicationStatus.accepted,
  $Enums.ApplicationStatus.rejected,
] as const;

// Map badge variant to a design-token dot color for stat card accents.
const BADGE_VARIANT_TO_DOT: Record<string, string> = {
  info: 'bg-info',
  warning: 'bg-warning',
  success: 'bg-success',
  destructive: 'bg-destructive',
  secondary: 'bg-muted-foreground',
  default: 'bg-primary',
  outline: 'bg-border',
};

export async function PipelineSummary() {
  const counts = await getApplicationStatusCounts();

  const total = PIPELINE_STATUSES.reduce((sum, s) => sum + (counts[s] ?? 0), 0);

  return (
    <section aria-label="Pipeline summary">
      {total === 0 && (
        <p className="text-muted-foreground mb-4 text-sm">
          No applications submitted yet.
        </p>
      )}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {PIPELINE_STATUSES.map((status) => {
          const count = counts[status] ?? 0;
          const variant = APPLICATION_STATUS_BADGE_VARIANT[status];
          const dotClass =
            BADGE_VARIANT_TO_DOT[variant] ?? 'bg-muted-foreground';

          return (
            <Card key={status} className="p-4">
              <CardContent className="p-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`size-2 shrink-0 rounded-full ${dotClass}`}
                    aria-hidden="true"
                  />
                  <p className="text-muted-foreground text-xs">
                    {APPLICATION_STATUS_LABELS[status]}
                  </p>
                </div>
                <p className="mt-2 text-2xl font-semibold tabular-nums">
                  {count}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
