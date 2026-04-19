'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { submitApplication } from '@/prisma/actions/applications';
import type {
  Application,
  GlobalApplicationAnswer,
  GlobalQuestion,
  PositionApplicationAnswer,
  PositionQuestion,
} from '@/prisma/client';

import { isError } from '@/lib/utils';

import { ApplicationQuestion } from '@/components/features/application-question';
import { Button } from '@/components/ui/button';

interface ApplicationStepperProps {
  application: Application & {
    globalAnswers: GlobalApplicationAnswer[];
    positionAnswers: PositionApplicationAnswer[];
  };
  globalQuestions: GlobalQuestion[];
  positionQuestions: PositionQuestion[];
  userId: string;
}

export function ApplicationStepper({
  application,
  globalQuestions,
  positionQuestions,
  userId,
}: ApplicationStepperProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  function handleSubmit() {
    setSubmitError(null);
    startTransition(async () => {
      const result = await submitApplication(application.id, userId);
      if (isError(result)) {
        setSubmitError(result.error);
        return;
      }
      router.push('/applications');
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <div
          className={`flex size-7 items-center justify-center rounded-full text-sm font-medium ${
            step === 1
              ? 'bg-primary text-primary-foreground'
              : 'bg-primary text-primary-foreground'
          }`}
        >
          1
        </div>
        <div className="bg-border h-px flex-1" />
        <div
          className={`flex size-7 items-center justify-center rounded-full text-sm font-medium ${
            step === 2
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          2
        </div>
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Your Profile
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Step 1 of 2 — Answer the global questions below. Your answers will
              be saved automatically.
            </p>
          </div>

          {globalQuestions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No global questions configured.
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              {globalQuestions.map((question) => {
                const answer =
                  application.globalAnswers.find(
                    (a: GlobalApplicationAnswer) =>
                      a.globalQuestionId === question.id,
                  ) ?? null;
                return (
                  <ApplicationQuestion
                    key={question.id}
                    applicationId={application.id}
                    question={question}
                    answer={answer}
                    isGlobal={true}
                    userId={userId}
                  />
                );
              })}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={() => setStep(2)}>Next</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Position-Specific Questions
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Step 2 of 2 — Answer the questions specific to this position. Your
              answers will be saved automatically.
            </p>
          </div>

          {positionQuestions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No position-specific questions for this role.
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              {positionQuestions.map((question) => {
                const answer =
                  application.positionAnswers.find(
                    (a: PositionApplicationAnswer) =>
                      a.positionQuestionId === question.id,
                  ) ?? null;
                return (
                  <ApplicationQuestion
                    key={question.id}
                    applicationId={application.id}
                    question={question}
                    answer={answer}
                    isGlobal={false}
                    userId={userId}
                  />
                );
              })}
            </div>
          )}

          {submitError && (
            <p className="text-destructive text-sm">{submitError}</p>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? 'Submitting...' : 'Submit Application'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
