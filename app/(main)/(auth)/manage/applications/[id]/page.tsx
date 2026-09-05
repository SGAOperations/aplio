import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import {
  getApplicationForReview,
  getApplicationStatusHistory,
  getDecisionEmailNotice,
} from '@/prisma/data/applications';

import { getCurrentUser } from '@/lib/auth/server';
import { CONCEPT_ICONS } from '@/lib/icons';
import { getDisplayName, getRenamedTo } from '@/lib/utils';

import { ApplicantOtherApplications } from '@/components/features/applicant-other-applications';
import { ApplicationAnswersList } from '@/components/features/application-answers-list';
import { ApplicationStatusHeaderActions } from '@/components/features/application-status-header-actions';
import { ApplicationStatusBadge } from '@/components/features/status-badge';
import { PageHeader } from '@/components/layouts/page-header';
import { LocalTime } from '@/components/ui/local-time';
import { SectionCard, SectionCardSkeleton } from '@/components/ui/section-card';

interface ApplicationDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: ApplicationDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const user = await getCurrentUser();
  const application = await getApplicationForReview(id, user);
  if (!application) return {};
  return { title: getDisplayName(application) };
}

export default async function ApplicationDetailPage({
  params,
}: ApplicationDetailPageProps) {
  const { id } = await params;
  const user = await getCurrentUser();

  const [application, history] = await Promise.all([
    getApplicationForReview(id, user),
    getApplicationStatusHistory(id, user),
  ]);

  if (!application) notFound();

  const decisionEmailState = await getDecisionEmailNotice(
    id,
    application.status,
    user,
  );

  const applicantName = getDisplayName(application);
  const renamedTo = getRenamedTo(application);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <PageHeader
          title={renamedTo ? `${applicantName} (${renamedTo})` : applicantName}
          description={application.user.email}
          backHref="/manage/applications"
          backLabel="Back to Applications"
          titleAdornment={
            <ApplicationStatusBadge status={application.status} />
          }
          actions={
            <ApplicationStatusHeaderActions
              applicationId={application.id}
              currentStatus={application.status}
              applicantName={applicantName}
              history={history}
              decisionEmailState={decisionEmailState}
            />
          }
        />
        <p className="text-muted-foreground mt-1 text-sm">
          <Link
            href={`/positions/${application.position.id}`}
            className="underline"
          >
            {application.position.title}
          </Link>{' '}
          · Applied{' '}
          <LocalTime date={application.submittedAt} precision="date" />
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <Suspense
          fallback={
            <SectionCardSkeleton
              rowShape="badge-meta"
              hasSubtitle
              hasLink={false}
            />
          }
        >
          <ApplicantOtherApplications
            applicationId={application.id}
            user={user}
          />
        </Suspense>

        <SectionCard
          title="Profile answers"
          icon={CONCEPT_ICONS.profile}
          titleAs="h2"
        >
          <ApplicationAnswersList
            answers={application.globalAnswers}
            emptyMessage="No profile answers."
            applicationId={application.id}
          />
        </SectionCard>

        {(application.hasPositionQuestions ||
          application.positionAnswers.length > 0) && (
          <SectionCard
            title="Position answers"
            icon={CONCEPT_ICONS.position}
            titleAs="h2"
          >
            <ApplicationAnswersList
              answers={application.positionAnswers}
              emptyMessage="No position-specific answers."
              applicationId={application.id}
            />
          </SectionCard>
        )}
      </div>
    </div>
  );
}
