import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getApplicationForReview } from '@/prisma/data/applications';

import { getCurrentUser } from '@/lib/auth/server';
import { getRenamedTo } from '@/lib/utils';

import { ApplicationAnswersList } from '@/components/features/application-answers-list';
import { ApplicationStatusActions } from '@/components/features/application-status-actions';
import { ApplicationStatusBadge } from '@/components/features/status-badge';
import { PageHeader } from '@/components/layouts/page-header';
import { LocalTime } from '@/components/ui/local-time';
import { SectionCard } from '@/components/ui/section-card';

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

  const application = await getApplicationForReview(id, user);

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

      {/* Two-column layout at lg: Review panel sticky on right; answers on left */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: answers (lg:col-span-2) */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <SectionCard title="Profile answers" titleAs="h2">
            <ApplicationAnswersList
              answers={application.globalAnswers}
              emptyMessage="No profile answers."
              applicationId={application.id}
            />
          </SectionCard>

          <SectionCard title="Position answers" titleAs="h2">
            <ApplicationAnswersList
              answers={application.positionAnswers}
              emptyMessage="No position-specific answers."
              applicationId={application.id}
            />
          </SectionCard>
        </div>

        {/* Right: Review panel — sticky on lg, stacked first on mobile */}
        <div className="order-first lg:sticky lg:top-6 lg:order-none lg:max-h-[calc(100svh-3rem)] lg:self-start lg:overflow-y-auto">
          <SectionCard title="Review" titleAs="h2">
            <div className="flex flex-col gap-3 p-4">
              <ApplicationStatusBadge status={application.status} />
              <ApplicationStatusActions
                applicationId={application.id}
                currentStatus={application.status}
                applicantName={applicantName}
              />
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
