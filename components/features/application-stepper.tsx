'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { submitApplication } from '@/prisma/actions/applications';
import type {
  GlobalAnswer,
  GlobalApplicationAnswer,
  GlobalQuestion,
  PositionApplicationAnswer,
  PositionQuestion,
} from '@/prisma/client';

import { type DraftApplication } from '@/lib/types';
import { isError } from '@/lib/utils';

import { ApplicationQuestion } from '@/components/features/application-question';
import { Button } from '@/components/ui/button';

interface ApplicationStepperProps {
  application: DraftApplication;
  globalQuestions: GlobalQuestion[];
  globalAnswers: GlobalAnswer[];
  positionQuestions: PositionQuestion[];
  userId: string;
}

export function ApplicationStepper({
  application,
  globalQuestions,
  globalAnswers,
  positionQuestions,
  userId,
}: ApplicationStepperProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const {
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm();

  function handleNext() {
    const hasEmpty = globalQuestions.some((q) => {
      if (!q.required) return false;
      const value = isCustomizing
        ? application.globalAnswers.find(
            (a: GlobalApplicationAnswer) => a.globalQuestionId === q.id,
          )?.value
        : globalAnswers.find((a: GlobalAnswer) => a.globalQuestionId === q.id)
            ?.value;
      return !(value as string[] | undefined)?.length;
    });
    if (hasEmpty) {
      setError('root', {
        message: 'Please fill in all required fields before continuing.',
      });
      return;
    }
    clearErrors();
    setStep(2);
  }

  const onSubmit = handleSubmit(async () => {
    const hasEmpty = positionQuestions.some((q) => {
      if (!q.required) return false;
      const value =
        application.positionAnswers.find(
          (a: PositionApplicationAnswer) => a.positionQuestionId === q.id,
        )?.value ?? [];
      return !(value as string[]).length;
    });
    if (hasEmpty) {
      setError('root', {
        message: 'Please fill in all required fields before submitting.',
      });
      return;
    }
    const result = await submitApplication(application.id, userId);
    if (isError(result)) setError('root', { message: result.error });
    else router.push('/applications');
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-full text-sm font-medium">
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
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Your Profile
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                These answers come from your profile and apply to all
                applications.
              </p>
            </div>
            <Button
              variant={isCustomizing ? 'default' : 'outline'}
              size="sm"
              className="mt-0.5 shrink-0"
              onClick={() => setIsCustomizing(!isCustomizing)}
            >
              {isCustomizing ? 'Use profile answers' : 'Customize'}
            </Button>
          </div>

          {isCustomizing && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              These answers are saved for this application only. To update your
              answers permanently, visit your{' '}
              <Link href="/profile" className="font-medium underline">
                profile page
              </Link>
              .
            </div>
          )}

          <div className="flex flex-col gap-4">
            {globalQuestions.map((question) => {
              const profileAnswer =
                globalAnswers.find(
                  (a: GlobalAnswer) => a.globalQuestionId === question.id,
                ) ?? null;
              const customAnswer =
                application.globalAnswers.find(
                  (a: GlobalApplicationAnswer) =>
                    a.globalQuestionId === question.id,
                ) ?? null;
              return (
                <ApplicationQuestion
                  key={question.id}
                  applicationId={application.id}
                  question={question}
                  answer={isCustomizing ? customAnswer : null}
                  profileAnswer={profileAnswer}
                  readOnly={!isCustomizing}
                  isGlobal={true}
                  userId={userId}
                />
              );
            })}
          </div>

          {errors.root && (
            <p className="text-destructive text-sm">{errors.root.message}</p>
          )}

          <div className="flex justify-end">
            <Button onClick={handleNext}>Next</Button>
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
              Answer the questions specific to this position. Your answers will
              be saved automatically.
            </p>
          </div>

          <div className="flex flex-col gap-4">
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
                  profileAnswer={null}
                  readOnly={false}
                  isGlobal={false}
                  userId={userId}
                />
              );
            })}
          </div>

          {errors.root && (
            <p className="text-destructive text-sm">{errors.root.message}</p>
          )}

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => {
                clearErrors();
                setStep(1);
              }}
            >
              Back
            </Button>
            <Button onClick={onSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Application'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
