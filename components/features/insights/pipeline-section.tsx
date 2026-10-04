import { getPipelineInsights } from '@/prisma/data/insights';

import { percent } from '@/lib/insights';
import type { InsightsRange } from '@/lib/types';

import {
  InsightSection,
  InsightSectionSkeleton,
} from '@/components/features/insights/insight-section';
import {
  InsightTile,
  InsightTileSkeleton,
} from '@/components/features/insights/insight-tile';

interface PipelineSectionProps {
  range: InsightsRange;
}

export async function PipelineSection({ range }: PipelineSectionProps) {
  const pipeline = await getPipelineInsights(range);

  return (
    <InsightSection slug="pipeline" title="Pipeline">
      <InsightTile
        label="Backward moves"
        value={String(pipeline.backwardCount)}
        caption={
          pipeline.reviewerEventCount > 0
            ? `${percent(pipeline.backwardCount, pipeline.reviewerEventCount)}% of reviewer events`
            : undefined
        }
      />
      <InsightTile
        label="Decision flips"
        value={String(pipeline.decisionFlipCount)}
        caption={
          pipeline.reviewerEventCount > 0
            ? `${percent(pipeline.decisionFlipCount, pipeline.reviewerEventCount)}% of reviewer events`
            : undefined
        }
      />
    </InsightSection>
  );
}

export function PipelineSectionSkeleton() {
  return (
    <InsightSectionSkeleton title="Pipeline">
      <InsightTileSkeleton />
      <InsightTileSkeleton />
    </InsightSectionSkeleton>
  );
}
