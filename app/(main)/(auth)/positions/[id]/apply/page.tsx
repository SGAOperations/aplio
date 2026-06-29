import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createDraftApplication } from '@/prisma/actions/applications';
import { getPositionForApply } from '@/prisma/data/positions';
import { getProfileData } from '@/prisma/data/profile';

import { getCurrentUser } from '@/lib/auth/server';
import { isError, toStringArray } from '@/lib/utils';

import { ApplicationStepper } from '@/components/features/application-stepper';
import { PageHeader } from '@/components/layouts/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

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
  if (!user) redirect('/sign-in');

  const [position, profileData] = await Promise.all([
    getPositionForApply(id),
    getProfileData(user.id),
  ]);

  if (!position) redirect('/positions');

  const globalQuestions = profileData.map((d) => d.question);
  const globalAnswers = profileData.flatMap((d) =>
    d.answer ? [d.answer] : [],
  );

  // Gate must match submitApplication: requires non-empty value, not just a record existing.
  const profileComplete =
    profileData.length === 0 ||
    profileData
      .filter((d) => d.question.required)
      .every((d) => toStringArray(d.answer?.value).length > 0);

  const applicationResult = profileComplete
    ? await createDraftApplication(id)
    : null;

  // If the profile is complete but the action returned an error, it is an
  // unexpected failure — surface it via the error boundary instead of showing
  // the misleading "complete your profile" gate.
  if (profileComplete && applicationResult && isError(applicationResult))
    throw new Error(applicationResult.error);

  const application =
    applicationResult && !isError(applicationResult) ? applicationResult : null;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <PageHeader
          title={`Apply: ${position.title}`}
          description={
            application
              ? 'Complete the form below to submit your application.'
              : undefined
          }
        />
      </div>

      {!application ? (
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
              <Link href="/profile">Go to Profile</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ApplicationStepper
          application={application}
          globalQuestions={globalQuestions}
          globalAnswers={globalAnswers}
          positionQuestions={position.questions}
        />
      )}
    </div>
  );
}
