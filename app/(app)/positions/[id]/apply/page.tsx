import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createDraftApplication } from '@/prisma/actions/applications';

import { getCurrentUser } from '@/lib/auth/server';
import prisma from '@/lib/prisma';

import { ApplicationStepper } from '@/components/features/application-stepper';
import { Button } from '@/components/ui/button';

interface ApplyPageProps {
  params: Promise<{ id: string }>;
}

export default async function ApplyPage({ params }: ApplyPageProps) {
  const { id } = await params;

  const user = await getCurrentUser();

  const position = await prisma.position.findFirst({
    where: { id, status: 'open', deletedAt: null },
    include: {
      questions: { where: { deletedAt: null }, orderBy: { order: 'asc' } },
    },
  });

  if (!position) redirect('/positions');

  const [globalQuestions, globalAnswers] = await Promise.all([
    prisma.globalQuestion.findMany({
      where: { deletedAt: null },
      orderBy: { order: 'asc' },
    }),
    prisma.globalAnswer.findMany({
      where: { userId: user.id, deletedAt: null },
    }),
  ]);

  if (globalAnswers.length === 0)
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">
            Apply: {position.title}
          </h1>
        </div>
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
      </div>
    );

  const draftApp = await createDraftApplication(user.id, id);

  const application = await prisma.application.findUniqueOrThrow({
    where: { id: draftApp.id },
    include: { globalAnswers: true, positionAnswers: true },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Apply: {position.title}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Complete the form below to submit your application.
        </p>
      </div>

      <ApplicationStepper
        application={application}
        globalQuestions={globalQuestions}
        globalAnswers={globalAnswers}
        positionQuestions={position.questions}
        userId={user.id}
      />
    </div>
  );
}
