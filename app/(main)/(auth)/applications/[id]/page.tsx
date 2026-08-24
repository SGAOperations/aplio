import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import {
  getApplicationForReview,
  getApplicationStatusHistory,
} from '@/prisma/data/applications';

import { getCurrentUser } from '@/lib/auth/server';
import { getRenamedTo } from '@/lib/utils';

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
  return {
    title:
      application.applicantName ??
      application.user.name ??
      application.user.email,
  };
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

  const applicantName =
    application.applicantName ??
    application.user.name ??
    application.user.email;
  const renamedTo = getRenamedTo(application);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <PageHeader
          title={renamedTo ? `${applicantName} (${renamedTo})` : applicantName}
          description={application.user.email}
          backHref="/applications"
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
        <SectionCard title="Profile answers" titleAs="h2">
          <ApplicationAnswersList
            answers={application.globalAnswers}
            emptyMessage="No profile answers."
            applicationId={application.id}
          />
        </SectionCard>

        {(application.hasPositionQuestions ||
          application.positionAnswers.length > 0) && (
          <SectionCard title="Position answers" titleAs="h2">
            <ApplicationAnswersList
              answers={application.positionAnswers}
              emptyMessage="No position-specific answers."
              applicationId={application.id}
            />
          </SectionCard>
        )}

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
      </div>
    </div>
  );
}
