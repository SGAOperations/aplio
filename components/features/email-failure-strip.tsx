import Link from 'next/link';

import { getEmailFailureCounts } from '@/prisma/data/emails';

import {
  EMAIL_FAILURE_STATUSES,
  EMAIL_FAILURE_WINDOW_DAYS,
  EMAIL_STATUS_BADGE_VARIANT,
  EMAIL_STATUS_LABELS,
  STATUS_BADGE_VARIANT_TO_DOT,
} from '@/lib/constants';
import { buildEmailLogHref } from '@/lib/utils';

import { StatCard } from '@/components/features/stat-card';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export async function EmailFailureStrip() {
  const counts = await getEmailFailureCounts();
  const allZero = EMAIL_FAILURE_STATUSES.every(
    (status) => counts[status] === 0,
  );

  return (
    <section aria-label="Delivery failures" className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-4">
        {EMAIL_FAILURE_STATUSES.map((status) => {
          const count = counts[status];
          const variant = EMAIL_STATUS_BADGE_VARIANT[status];
          const label = EMAIL_STATUS_LABELS[status];
          return (
            <Link
              key={status}
              href={buildEmailLogHref({ status })}
              className="focus-visible:ring-ring/50 block rounded-lg outline-none focus-visible:ring-[3px]"
              aria-label={`Filter by ${label.toLowerCase()} — ${count} in the last ${EMAIL_FAILURE_WINDOW_DAYS} days`}
            >
              <StatCard
                label={label}
                value={count}
                dotClassName={STATUS_BADGE_VARIANT_TO_DOT[variant]}
              />
            </Link>
          );
        })}
      </div>
      <p className="text-muted-foreground text-xs">
        {allZero
          ? `No delivery failures in the last ${EMAIL_FAILURE_WINDOW_DAYS} days.`
          : `Last ${EMAIL_FAILURE_WINDOW_DAYS} days`}
      </p>
    </section>
  );
}

export function EmailFailureStripSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-4">
            <CardContent className="p-0">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2 h-8 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-3 w-40" />
    </div>
  );
}
