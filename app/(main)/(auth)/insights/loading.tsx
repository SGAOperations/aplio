import { ApplicantsSectionSkeleton } from '@/components/features/insights/applicants-section';
import { AttentionSectionSkeleton } from '@/components/features/insights/attention-section';
import { FunnelSectionSkeleton } from '@/components/features/insights/funnel-section';
import { PipelineSectionSkeleton } from '@/components/features/insights/pipeline-section';
import { PositionsSectionSkeleton } from '@/components/features/insights/positions-section';
import { QuestionsSectionSkeleton } from '@/components/features/insights/questions-section';
import { ReviewSpeedSectionSkeleton } from '@/components/features/insights/review-speed-section';
import { VolumeSectionSkeleton } from '@/components/features/insights/volume-section';
import { PageHeaderSkeleton } from '@/components/layouts/page-header';
import { DataTableToolbarSkeleton } from '@/components/ui/data-table-toolbar';
import { Skeleton } from '@/components/ui/skeleton';

export default function InsightsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton titleWidth="w-24" />
      <DataTableToolbarSkeleton fields={['sm:w-52']} />
      <Skeleton className="h-5 w-64" />
      <AttentionSectionSkeleton />
      <VolumeSectionSkeleton />
      <ReviewSpeedSectionSkeleton />
      <PipelineSectionSkeleton />
      <FunnelSectionSkeleton />
      <QuestionsSectionSkeleton />
      <ApplicantsSectionSkeleton />
      <PositionsSectionSkeleton />
    </div>
  );
}
