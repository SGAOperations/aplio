import { redirect } from 'next/navigation';

import { createDraftApplication } from '@/prisma/actions/applications';

import { getCurrentUser } from '@/lib/auth/server';
import prisma from '@/lib/prisma';

import { ApplicationStepper } from '@/components/features/application-stepper';

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

  const globalQuestions = await prisma.globalQuestion.findMany({
    where: { deletedAt: null },
    orderBy: { order: 'asc' },
  });

  const draftApp = await createDraftApplication(user.id, id);

  const application = await prisma.application.findUniqueOrThrow({
    where: { id: draftApp.id },
    include: { globalAnswers: true, positionAnswers: true },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Apply — {position.title}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Complete the form below to submit your application.
        </p>
      </div>

      <ApplicationStepper
        application={application}
        globalQuestions={globalQuestions}
        positionQuestions={position.questions}
        userId={user.id}
      />
    </div>
  );
}
