import Link from 'next/link';

import { getAttentionInsights } from '@/prisma/data/insights';

import { formatDuration } from '@/lib/insights';

import {
  InsightSection,
  InsightSectionSkeleton,
} from '@/components/features/insights/insight-section';
import { InsightTileSkeleton } from '@/components/features/insights/insight-tile';
import { ApplicationStatusBadge } from '@/components/features/status-badge';
import { Card } from '@/components/ui/card';

export async function AttentionSection() {
  const attention = await getAttentionInsights();

  return (
    <InsightSection
      slug="attention"
      title="Old Applications"
      note="Right now — not affected by the date range"
    >
      <Card className="gap-2 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">Aging Queue</h3>
          <span className="text-muted-foreground shrink-0 text-xs">
            {attention.untouched.count} untouched
            {attention.untouched.oldestDays !== null &&
              ` · oldest ${formatDuration(attention.untouched.oldestDays * 24)}`}
          </span>
        </div>
        {attention.agingQueue.oldest.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nothing waiting — every submitted application has been picked up.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {attention.agingQueue.oldest.map((row) => (
              <li
                key={row.applicationId}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <Link
                  href={`/manage/applications/${row.applicationId}`}
                  className="min-w-0 truncate hover:underline"
                >
                  {row.name} · {row.positionTitle}
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  <ApplicationStatusBadge status={row.status} />
                  <span className="text-muted-foreground text-xs">
                    {Math.round(row.ageDays)}d
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </InsightSection>
  );
}

export function AttentionSectionSkeleton() {
  return (
    <InsightSectionSkeleton title="Old Applications">
      <InsightTileSkeleton />
    </InsightSectionSkeleton>
  );
}
