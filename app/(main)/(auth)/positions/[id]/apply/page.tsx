import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getApplicationForApply } from '@/prisma/data/applications';
import { getPositionForApply } from '@/prisma/data/positions';
import { getProfileData } from '@/prisma/data/profile';

import { withRedirectTo } from '@/lib/auth/redirect';
import { getCurrentUser } from '@/lib/auth/server';
import {
  APPLICATION_STATUS_LABELS,
  UNRESOLVED_APPLICATION_STATUSES,
  isApplicantEditableApplicationStatus,
} from '@/lib/constants';
import { CONCEPT_ICONS, STATE_ICONS } from '@/lib/icons';
import {
  isAcceptingApplications,
  isAnswered,
  toStringArray,
} from '@/lib/utils';

import { ApplicationStepper } from '@/components/features/application-stepper';
import { StartApplicationCard } from '@/components/features/start-application-card';
import { ApplicationStatusBadge } from '@/components/features/status-badge';
import { PageHeader } from '@/components/layouts/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LocalTime } from '@/components/ui/local-time';

interface ApplyPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: ApplyPageProps): Promise<Metadata> {
  const { id } = await params;
  const position = await getPositionForApply(id);
  if (!position) return {};
  return { title: `Apply: ${position.title}` };
}

export default async function ApplyPage({ params }: ApplyPageProps) {
  const { id } = await params;
  const user = await getCurrentUser();

  const [position, profileData, application] = await Promise.all([
    getPositionForApply(id),
    getProfileData(user.id),
    getApplicationForApply(user.id, id),
  ]);

  // Resource-state redirect, not an authorization denial: soft-deleted or still-draft.
  if (!position) redirect('/positions');

  // A deleted draft reads as "no application" everywhere below; Start revives it.
  const activeApplication = application?.deletedAt ? null : application;

  const isAccepting = isAcceptingApplications(position);

  const globalQuestions = profileData.map((d) => d.question);
  const globalAnswers = profileData.flatMap((d) =>
    d.answer ? [d.answer] : [],
  );

  // Gate must match submitApplication: value must still fit the question's shape.
  // Only gates starting a new application — an existing one has its own
  // missing-required flow in the stepper (isCustomizing).
  const profileComplete =
    profileData.length === 0 ||
    profileData
      .filter((d) => d.question.required)
      .every((d) => isAnswered(d.question, toStringArray(d.answer?.value)));

  const isEditable =
    activeApplication &&
    isApplicantEditableApplicationStatus(activeApplication.status);

  const isResubmit = activeApplication?.status === 'withdrawn';

  const description =
    isEditable && isAccepting
      ? isResubmit
        ? 'Update your answers and resubmit your application.'
        : 'Complete the form below to submit your application.'
      : undefined;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <PageHeader
          title={`Apply: ${position.title}`}
          description={description}
        />
      </div>

      {activeApplication && !isEditable ? (
        <Card className="gap-0 p-0">
          <CardContent className="flex flex-col gap-4 p-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <CONCEPT_ICONS.myApplication className="text-muted-foreground size-4" />
                You&apos;ve already applied
              </h2>
              <div className="mt-2 flex items-center gap-2">
                <ApplicationStatusBadge status={activeApplication.status} />
                <span className="text-muted-foreground text-sm">
                  Submitted{' '}
                  <LocalTime
                    date={activeApplication.submittedAt}
                    precision="date"
                  />
                </span>
              </div>
              <p className="text-muted-foreground mt-3 text-sm">
                {UNRESOLVED_APPLICATION_STATUSES.includes(
                  activeApplication.status as (typeof UNRESOLVED_APPLICATION_STATUSES)[number],
                )
                  ? 'To change your answers, withdraw this application from My Applications, then edit and resubmit it.'
                  : `This application has been ${APPLICATION_STATUS_LABELS[activeApplication.status]} and can no longer be edited.`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="w-fit">
                <Link href="/my-applications">View my applications</Link>
              </Button>
              <Button asChild variant="ghost" className="w-fit">
                <Link href={`/my-applications/${activeApplication.id}`}>
                  View my answers
                </Link>
              </Button>
              <Button asChild variant="ghost" className="w-fit">
                <Link href={`/positions/${id}`}>Back to position</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : !isAccepting ? (
        <Card className="gap-0 p-0">
          <CardContent className="flex flex-col gap-4 p-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <STATE_ICONS.archived className="text-muted-foreground size-4" />
                Applications are closed
              </h2>
              <p className="text-muted-foreground mt-2 text-sm">
                {activeApplication
                  ? 'This position stopped accepting applications, so this application can no longer be edited or submitted.'
                  : 'This position is no longer accepting applications.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="w-fit">
                <Link
                  href={activeApplication ? '/my-applications' : '/positions'}
                >
                  {activeApplication
                    ? 'View my applications'
                    : 'Browse positions'}
                </Link>
              </Button>
              <Button asChild variant="ghost" className="w-fit">
                <Link href={`/positions/${id}`}>Back to position</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : !activeApplication && !profileComplete ? (
        <Card className="gap-0 p-0">
          <CardContent className="flex flex-col gap-4 p-4">
            <div>
              <p className="font-medium">Complete your profile first</p>
              <p className="text-muted-foreground mt-1 text-sm">
                You need to answer all required profile questions before
                applying. Your profile answers are shared across all
                applications.
              </p>
            </div>
            <Button asChild className="w-fit">
              <Link href={withRedirectTo('/profile', `/positions/${id}/apply`)}>
                Go to Profile
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : !activeApplication ? (
        <StartApplicationCard
          positionId={id}
          hasDeletedDraft={Boolean(application?.deletedAt)}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {isResubmit && (
            <div className="border-info/40 bg-info/10 text-foreground flex gap-2 rounded-lg border p-3 text-sm">
              <STATE_ICONS.info className="mt-0.5 size-4 shrink-0" />
              <div className="flex flex-col gap-1">
                <p className="font-medium">This application is withdrawn</p>
                <p>
                  It&apos;s out of the review queue, but reviewers can still see
                  your answers — including edits you make here. Resubmit to put
                  it back in the queue.
                </p>
              </div>
            </div>
          )}
          <ApplicationStepper
            application={activeApplication}
            globalQuestions={globalQuestions}
            globalAnswers={globalAnswers}
            positionQuestions={position.questions}
          />
        </div>
      )}
    </div>
  );
}
