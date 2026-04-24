'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { type Control, Controller, useForm } from 'react-hook-form';

import {
  createOrUpdateApplicationAnswer,
  submitApplication,
} from '@/prisma/actions/applications';
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

type StepperFormValues = Record<string, string[]>;

interface QuestionListProps {
  applicationId: string;
  questions: (GlobalQuestion | PositionQuestion)[];
  control: Control<StepperFormValues>;
  isGlobal: boolean;
  userId: string;
  readOnly?: boolean;
  profileAnswers?: GlobalAnswer[];
}

function ReadOnlyQuestionCard({
  question,
  displayValue,
}: {
  question: GlobalQuestion | PositionQuestion;
  displayValue: string[];
}) {
  return (
    <div className="bg-card rounded-lg border p-4 shadow-sm">
      <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
        {question.label}
        {question.required && <span className="text-destructive ml-1">*</span>}
      </p>
      {displayValue.length === 0 ? (
        <p className="text-muted-foreground text-sm italic">No answer yet</p>
      ) : question.type === 'multiple_choice' ? (
        <div className="flex flex-wrap gap-1.5">
          {displayValue.map((v) => (
            <span
              key={v}
              className="bg-muted text-muted-foreground rounded-md px-2 py-0.5 text-sm"
            >
              {v}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-foreground text-base font-medium">
          {displayValue[0]}
        </p>
      )}
    </div>
  );
}

function QuestionList({
  applicationId,
  questions,
  control,
  isGlobal,
  userId,
  readOnly,
  profileAnswers,
}: QuestionListProps) {
  if (questions.length === 0)
    return (
      <p className="text-muted-foreground text-sm">No questions configured.</p>
    );

  return (
    <div className="flex flex-col gap-4">
      {questions.map((question) => {
        if (readOnly) {
          const displayValue =
            (profileAnswers?.find(
              (a: GlobalAnswer) => a.globalQuestionId === question.id,
            )?.value as string[] | undefined) ?? [];
          return (
            <ReadOnlyQuestionCard
              key={question.id}
              question={question}
              displayValue={displayValue}
            />
          );
        }

        const fieldName = isGlobal ? `g_${question.id}` : `p_${question.id}`;

        return (
          <Controller
            key={question.id}
            control={control}
            name={fieldName}
            shouldUnregister={isGlobal}
            rules={{
              validate: (value) =>
                !question.required ||
                (Array.isArray(value) && value.length > 0) ||
                'This field is required',
            }}
            render={({ field, fieldState }) => (
              <ApplicationQuestion
                question={question}
                field={field}
                isDirty={fieldState.isDirty}
                error={fieldState.error?.message}
                onSave={async (value) => {
                  await createOrUpdateApplicationAnswer({
                    applicationId,
                    questionId: question.id,
                    questionLabel: question.label,
                    value,
                    isGlobal,
                    userId,
                  });
                }}
              />
            )}
          />
        );
      })}
    </div>
  );
}

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
    control,
    trigger,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<StepperFormValues>({
    defaultValues: Object.fromEntries([
      ...globalQuestions.map((q) => {
        const value =
          (application.globalAnswers.find(
            (a: GlobalApplicationAnswer) => a.globalQuestionId === q.id,
          )?.value as string[] | undefined) ??
          (globalAnswers.find((a: GlobalAnswer) => a.globalQuestionId === q.id)
            ?.value as string[] | undefined) ??
          [];
        return [`g_${q.id}`, value];
      }),
      ...positionQuestions.map((q) => {
        const value =
          (application.positionAnswers.find(
            (a: PositionApplicationAnswer) => a.positionQuestionId === q.id,
          )?.value as string[] | undefined) ?? [];
        return [`p_${q.id}`, value];
      }),
    ]),
  });

  async function handleNext() {
    if (isCustomizing) {
      const valid = await trigger(globalQuestions.map((q) => `g_${q.id}`));
      if (!valid) return;
    }
    clearErrors('root');
    setStep(2);
  }

  const onSubmit = handleSubmit(async () => {
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

          <QuestionList
            applicationId={application.id}
            questions={globalQuestions}
            control={control}
            isGlobal={true}
            userId={userId}
            readOnly={!isCustomizing}
            profileAnswers={globalAnswers}
          />

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

          <QuestionList
            applicationId={application.id}
            questions={positionQuestions}
            control={control}
            isGlobal={false}
            userId={userId}
          />

          {errors.root && (
            <p className="text-destructive text-sm">{errors.root.message}</p>
          )}

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => {
                clearErrors('root');
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
