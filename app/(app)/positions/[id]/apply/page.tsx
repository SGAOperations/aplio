import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createDraftApplication } from '@/prisma/actions/applications';
import { getPositionForApply } from '@/prisma/data/positions';
import { getProfileData } from '@/prisma/data/profile';

import { getCurrentUser } from '@/lib/auth/server';

import { ApplicationStepper } from '@/components/features/application-stepper';
import { Button } from '@/components/ui/button';

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  const [position, profileData] = await Promise.all([
    getPositionForApply(id),
    getProfileData(user.id),
  ]);

  if (!position) redirect('/positions');

  const globalQuestions = profileData.map((d) => d.question);
  const globalAnswers = profileData.flatMap((d) =>
    d.answer ? [d.answer] : [],
  );
  const application =
    globalAnswers.length > 0 ? await createDraftApplication(user.id, id) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Apply: {position.title}
        </h1>
        {application && (
          <p className="text-muted-foreground mt-1 text-sm">
            Complete the form below to submit your application.
          </p>
        )}
      </div>

      {!application ? (
        <div className="bg-muted rounded-lg p-6">
          <p className="font-medium">Complete your profile first</p>
          <p className="text-muted-foreground mt-1 text-sm">
            You need to fill out your profile before applying to any position.
            Your profile answers are shared across all applications.
          </p>
          <Button asChild className="mt-4">
            <Link href="/profile">Go to Profile</Link>
          </Button>
        </div>
      ) : (
        <ApplicationStepper
          application={application}
          globalQuestions={globalQuestions}
          globalAnswers={globalAnswers}
          positionQuestions={position.questions}
          userId={user.id}
        />
      )}
    </div>
  );
}
