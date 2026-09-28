import Link from 'next/link';
import type { ReactNode } from 'react';

import { getAttentionInsights } from '@/prisma/data/insights';

import { STATE_ICONS } from '@/lib/icons';
import { formatDuration } from '@/lib/insights';
import { buildEmailLogHref } from '@/lib/search-params';

import {
  InsightSection,
  InsightSectionSkeleton,
} from '@/components/features/insights/insight-section';
import {
  InsightTile,
  InsightTileSkeleton,
} from '@/components/features/insights/insight-tile';
import { ApplicationStatusBadge } from '@/components/features/status-badge';
import { Card } from '@/components/ui/card';

function ListCard({
  title,
  description,
  emptyMessage,
  children,
}: {
  title: string;
  description?: string;
  emptyMessage: string;
  children: ReactNode[];
}) {
  return (
    <Card className="gap-2 p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && (
        <p className="text-muted-foreground text-xs">{description}</p>
      )}
      {children.length === 0 ? (
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      ) : (
        <ul className="flex flex-col gap-2">{children}</ul>
      )}
    </Card>
  );
}

export async function AttentionSection() {
  const attention = await getAttentionInsights();

  return (
    <InsightSection
      slug="attention"
      title="Needs Attention"
      note="Right now — not affected by the date range"
    >
      <InsightTile
        label="Untouched applications"
        value={String(attention.untouched.count)}
        caption={
          attention.untouched.oldestDays !== null
            ? `Oldest waiting ${formatDuration(attention.untouched.oldestDays * 24)}`
            : undefined
        }
      />

      <ListCard
        title="Aging queue"
        emptyMessage="Nothing waiting — every submitted application has been picked up."
      >
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
      </ListCard>

      <ListCard
        title="Undelivered decisions"
        description="These applicants were never told their decision. Email them directly."
        emptyMessage="No failed decision emails."
      >
        {attention.undeliveredDecisions.map((row) => (
          <li
            key={row.applicationId}
            className="flex items-start gap-2 text-sm"
          >
            <STATE_ICONS.error className="text-destructive mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <Link
                href={buildEmailLogHref({ statuses: [row.emailStatus] })}
                className="hover:underline"
              >
                {row.name} ({row.to})
              </Link>
              <p className="text-muted-foreground text-xs">
                {row.positionTitle} ·{' '}
                {row.error ?? row.bounceType ?? 'Delivery failed'}
              </p>
            </div>
          </li>
        ))}
      </ListCard>

      <ListCard
        title="Closing soon"
        emptyMessage="No positions close in the next 7 days."
      >
        {attention.closingSoon.map((row) => (
          <li
            key={row.positionId}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <Link
              href={`/manage/positions/${row.positionId}/edit`}
              className="min-w-0 truncate hover:underline"
            >
              {row.title}
            </Link>
            <span className="text-muted-foreground shrink-0 text-xs">
              {row.submittedCount} submitted
            </span>
          </li>
        ))}
      </ListCard>
    </InsightSection>
  );
}

export function AttentionSectionSkeleton() {
  return (
    <InsightSectionSkeleton title="Needs Attention">
      <InsightTileSkeleton />
      <InsightTileSkeleton />
      <InsightTileSkeleton />
      <InsightTileSkeleton />
    </InsightSectionSkeleton>
  );
}
