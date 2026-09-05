import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getMyApplication } from '@/prisma/data/applications';

import { getCurrentUser } from '@/lib/auth/server';
import {
  type PublicApplicationStatus,
  TERMINAL_DECISION_STATUSES,
} from '@/lib/constants';
import { CONCEPT_ICONS } from '@/lib/icons';

import { ApplicationAnswersList } from '@/components/features/application-answers-list';
import { MyApplicationPrimaryAction } from '@/components/features/my-application-primary-action';
import { MyApplicationRowActions } from '@/components/features/my-application-row-actions';
import { ApplicationStatusBadge } from '@/components/features/status-badge';
import { PageHeader } from '@/components/layouts/page-header';
import { LocalTime } from '@/components/ui/local-time';
import { SectionCard } from '@/components/ui/section-card';

interface MyApplicationDetailPageProps {
  params: Promise<{ id: string }>;
}

// Exhaustive on the public status, so a new status breaks the build here too.
const STATUS_COPY: Record<PublicApplicationStatus, string> = {
  draft: "You haven't submitted this application yet.",
  applied: "Submitted. We'll update you here as it moves through review.",
  accepted: "You've been accepted for this position!",
  rejected: "This application wasn't selected.",
  withdrawn:
    'You withdrew this application. You can edit and resubmit it to put it back in the queue.',
};

export async function generateMetadata({
  params,
}: MyApplicationDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const user = await getCurrentUser();
  const application = await getMyApplication(id, user.id);
  if (!application) return {};
  return { title: application.position.title };
}

export default async function MyApplicationDetailPage({
  params,
}: MyApplicationDetailPageProps) {
  const { id } = await params;
  const user = await getCurrentUser();

  const application = await getMyApplication(id, user.id);

  if (!application) notFound();

  const isDraft = application.status === 'draft';

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <PageHeader
          title={application.position.title}
          description={STATUS_COPY[application.status]}
          backHref="/my-applications"
          backLabel="Back to My Applications"
          titleAdornment={
            <ApplicationStatusBadge status={application.status} />
          }
          actions={
            !TERMINAL_DECISION_STATUSES.includes(application.status) && (
              <>
                <MyApplicationPrimaryAction application={application} />
                <MyApplicationRowActions
                  applicationId={application.id}
                  status={application.status}
                  positionTitle={application.position.title}
                />
              </>
            )
          }
        />
        <p className="text-muted-foreground mt-1 text-sm">
          {isDraft ? 'Draft · last saved ' : 'Applied '}
          <LocalTime
            date={application.lastSavedAt ?? application.submittedAt}
            precision="date"
          />{' '}
          ·{' '}
          <Link
            href={`/positions/${application.position.id}`}
            className="underline"
          >
            View position
          </Link>
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <SectionCard
          title="Your profile answers"
          icon={CONCEPT_ICONS.profile}
          titleAs="h2"
        >
          <ApplicationAnswersList
            answers={application.globalAnswers}
            emptyMessage="No profile answers saved yet."
            applicationId={application.id}
          />
        </SectionCard>

        {(application.hasPositionQuestions ||
          application.positionAnswers.length > 0) && (
          <SectionCard
            title="Your answers for this position"
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
