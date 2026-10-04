import Link from 'next/link';

import { getPositionInsights } from '@/prisma/data/insights';

import { formatDuration, maxByValue } from '@/lib/insights';
import type { InsightsRange } from '@/lib/types';

import { InsightBarChart } from '@/components/features/insights/insight-bar-chart';
import {
  InsightCard,
  InsightCardSkeleton,
} from '@/components/features/insights/insight-card';
import {
  InsightSection,
  InsightSectionSkeleton,
} from '@/components/features/insights/insight-section';
import { Card } from '@/components/ui/card';

interface PositionsSectionProps {
  range: InsightsRange;
}

export async function PositionsSection({ range }: PositionsSectionProps) {
  const positions = await getPositionInsights(range);
  const topManager = maxByValue(positions.managerLoad, (m) => m.submitted);

  return (
    <InsightSection slug="positions" title="Positions and Reviewers">
      <Card className="gap-2 p-4">
        <h3 className="text-sm font-semibold">
          Positions with Zero Applications
        </h3>
        <p className="text-muted-foreground text-xs">
          Live positions with no submitted applications in this range — usually
          a visibility problem, not a demand problem.
        </p>
        {positions.zeroApplicationPositions.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Every live position received at least one application.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {positions.zeroApplicationPositions.map((p) => (
              <li key={p.positionId} className="text-sm">
                <Link
                  href={`/manage/positions/${p.positionId}/edit`}
                  className="hover:underline"
                >
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="gap-2 p-4">
        <h3 className="text-sm font-semibold">Time to First Application</h3>
        <p className="text-muted-foreground text-xs">
          Time from a position opening to its first submission.
        </p>
        {positions.timeToFirstApplication.medianDays !== null && (
          <p className="text-sm">
            Median{' '}
            {formatDuration(positions.timeToFirstApplication.medianDays * 24)}
          </p>
        )}
        {positions.timeToFirstApplication.positions.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No positions opened in this range with a submission yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {positions.timeToFirstApplication.positions
              .slice(0, 10)
              .map((p) => (
                <li
                  key={p.positionId}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate">{p.title}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {formatDuration(p.days * 24)}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </Card>

      <InsightCard
        title="Manager Load"
        description="Submitted and currently-unresolved applications, per manager of the position."
        meta={`n = ${positions.managerLoad.length}`}
        takeaway={
          topManager && topManager.submitted > 0
            ? `${topManager.name} has the most submissions (${topManager.submitted}), ${topManager.unresolved} unresolved.`
            : undefined
        }
        isEmpty={positions.managerLoad.length === 0}
        emptyMessage="No managers in this range."
      >
        <InsightBarChart
          data={positions.managerLoad.map((m) => ({
            label: m.name,
            value: m.submitted,
          }))}
        />
      </InsightCard>

      <Card className="gap-2 p-4">
        <h3 className="text-sm font-semibold">Reviewer Throughput</h3>
        <p className="text-muted-foreground text-xs">
          Status changes each reviewer made in this range. Small numbers — not a
          ranking.
        </p>
        {positions.reviewerThroughput.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No reviewer activity in this range.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {positions.reviewerThroughput.map((r) => (
              <li
                key={r.reviewerId}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="truncate">{r.name}</span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {r.eventCount} changes
                  {r.medianDecisionHours !== null &&
                    ` · median ${formatDuration(r.medianDecisionHours)} to decide`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </InsightSection>
  );
}

export function PositionsSectionSkeleton() {
  return (
    <InsightSectionSkeleton title="Positions and Reviewers">
      <InsightCardSkeleton />
      <InsightCardSkeleton />
      <InsightCardSkeleton />
      <InsightCardSkeleton />
    </InsightSectionSkeleton>
  );
}
