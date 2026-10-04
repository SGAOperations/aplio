import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { hasAnySubmittedApplication } from '@/prisma/data/insights';

import { requireAdminOr404 } from '@/lib/auth/guards';
import { ORG_TIMEZONE } from '@/lib/constants';
import { formatInstant } from '@/lib/dates';
import { CONCEPT_ICONS } from '@/lib/icons';
import { resolveInsightsRange } from '@/lib/insights';
import { loadInsightsSearchParams } from '@/lib/search-params';

import {
  ApplicantsSection,
  ApplicantsSectionSkeleton,
} from '@/components/features/insights/applicants-section';
import {
  AttentionSection,
  AttentionSectionSkeleton,
} from '@/components/features/insights/attention-section';
import {
  FunnelSection,
  FunnelSectionSkeleton,
} from '@/components/features/insights/funnel-section';
import { InsightsRangeToolbar } from '@/components/features/insights/insights-range-toolbar';
import {
  PipelineSection,
  PipelineSectionSkeleton,
} from '@/components/features/insights/pipeline-section';
import {
  PositionsSection,
  PositionsSectionSkeleton,
} from '@/components/features/insights/positions-section';
import {
  QuestionsSection,
  QuestionsSectionSkeleton,
} from '@/components/features/insights/questions-section';
import {
  ReviewSpeedSection,
  ReviewSpeedSectionSkeleton,
} from '@/components/features/insights/review-speed-section';
import {
  VolumeSection,
  VolumeSectionSkeleton,
} from '@/components/features/insights/volume-section';
import { PageHeader } from '@/components/layouts/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Insights' };

interface InsightsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function formatResolvedRange(start: Date | null, end: Date): string {
  const endLabel = formatInstant(end, {
    precision: 'date',
    timeZone: ORG_TIMEZONE,
  });
  if (!start) return `Showing all time through ${endLabel}`;
  const startLabel = formatInstant(start, {
    precision: 'date',
    timeZone: ORG_TIMEZONE,
  });
  return `Showing ${startLabel} – ${endLabel}`;
}

export default async function InsightsPage({
  searchParams,
}: InsightsPageProps) {
  await requireAdminOr404();

  const parsed = await loadInsightsSearchParams(searchParams);
  const range = resolveInsightsRange(parsed, new Date());
  const rangeKey = `${range.preset}:${range.fromDay ?? 'all'}:${range.toDay}`;

  const hasData = await hasAnySubmittedApplication();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Insights"
        description="How the application pipeline is performing. Days are counted in Eastern Time."
      />

      {!hasData ? (
        <EmptyState
          icon={CONCEPT_ICONS.insights}
          title="No applications yet"
          description="Insights fill in once applicants start submitting."
          action={
            <Button asChild>
              <Link href="/manage/positions">Manage positions</Link>
            </Button>
          }
        />
      ) : (
        <>
          <InsightsRangeToolbar today={range.toDay} />
          <p className="text-muted-foreground text-sm">
            {formatResolvedRange(range.start, range.end)}
          </p>

          <Suspense fallback={<AttentionSectionSkeleton />}>
            <AttentionSection />
          </Suspense>
          <Suspense key={rangeKey} fallback={<VolumeSectionSkeleton />}>
            <VolumeSection range={range} />
          </Suspense>
          <Suspense key={rangeKey} fallback={<ReviewSpeedSectionSkeleton />}>
            <ReviewSpeedSection range={range} />
          </Suspense>
          <Suspense key={rangeKey} fallback={<PipelineSectionSkeleton />}>
            <PipelineSection range={range} />
          </Suspense>
          <Suspense key={rangeKey} fallback={<FunnelSectionSkeleton />}>
            <FunnelSection range={range} />
          </Suspense>
          <Suspense key={rangeKey} fallback={<QuestionsSectionSkeleton />}>
            <QuestionsSection range={range} />
          </Suspense>
          <Suspense key={rangeKey} fallback={<ApplicantsSectionSkeleton />}>
            <ApplicantsSection range={range} />
          </Suspense>
          <Suspense key={rangeKey} fallback={<PositionsSectionSkeleton />}>
            <PositionsSection range={range} />
          </Suspense>
        </>
      )}
    </div>
  );
}
