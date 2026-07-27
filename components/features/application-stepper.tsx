'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type RefObject, useRef, useState } from 'react';
import { type Control, Controller, useForm, useWatch } from 'react-hook-form';

import { CheckIcon } from 'lucide-react';
import { toast } from 'sonner';

import {
  createOrUpdateApplicationAnswer,
  submitApplication,
} from '@/prisma/actions/applications';
import type {
  GlobalAnswer,
  GlobalApplicationAnswer,
  GlobalQuestion,
  PositionApplicationAnswer,
} from '@/prisma/client';

import { type DraftApplication, type PositionWithQuestions } from '@/lib/types';
import { cn, isError, toStringArray } from '@/lib/utils';

import { ApplicationQuestion } from '@/components/features/application-question';
import { Button } from '@/components/ui/button';

type StepperFormValues = Record<string, string[]>;

type NarrowQuestion = {
  id: string;
  label: string;
  type: GlobalQuestion['type'];
  required: boolean;
  options: string[];
  allowOther: boolean;
};

interface QuestionListProps {
  applicationId: string;
  questions: NarrowQuestion[];
  control: Control<StepperFormValues>;
  isGlobal: boolean;
  readOnly?: boolean;
  profileAnswers?: GlobalAnswer[];
  formValues?: StepperFormValues;
  missingGlobalIds?: Set<string>;
  // Keyed by question id — lets the "Use profile answers" revert wait for any
  // in-flight blur autosave on the same field before writing over it, so the
  // revert (issued later) is always the last write and what's displayed
  // matches what's persisted.
  pendingSavesRef?: RefObject<Map<string, Promise<unknown>>>;
}

function ReadOnlyQuestionCard({
  question,
  displayValue,
  isMissing,
}: {
  question: NarrowQuestion;
  displayValue: string[];
  isMissing?: boolean;
}) {
  return (
    <div
      className={cn(
        'bg-card rounded-lg border p-4 shadow-sm',
        isMissing && 'border-destructive',
      )}
    >
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
      {isMissing && (
        <p className="text-destructive mt-2 text-xs">This field is required</p>
      )}
    </div>
  );
}

function QuestionList({
  applicationId,
  questions,
  control,
  isGlobal,
  readOnly,
  profileAnswers,
  formValues,
  missingGlobalIds,
  pendingSavesRef,
}: QuestionListProps) {
  if (questions.length === 0)
    return (
      <p className="text-muted-foreground text-sm">No questions configured.</p>
    );

  return (
    <div className="flex flex-col gap-4">
      {questions.map((question) => {
        if (readOnly) {
          const displayValue = formValues
            ? toStringArray(formValues[`g_${question.id}`])
            : toStringArray(
                profileAnswers?.find(
                  (a: GlobalAnswer) => a.globalQuestionId === question.id,
                )?.value,
              );
          return (
            <ReadOnlyQuestionCard
              key={question.id}
              question={question}
              displayValue={displayValue}
              isMissing={missingGlobalIds?.has(question.id)}
            />
          );
        }

        const fieldName = isGlobal ? `g_${question.id}` : `p_${question.id}`;

        return (
          <Controller
            key={question.id}
            control={control}
            name={fieldName}
            shouldUnregister={false}
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
                error={fieldState.error?.message}
                onSave={async (value) => {
                  const save = (async () => {
                    const result = await createOrUpdateApplicationAnswer({
                      applicationId,
                      questionId: question.id,
                      questionLabel: question.label,
                      value,
                      isGlobal,
                    });
                    if (isError(result)) throw new Error(result.error);
                  })();
                  // Track this in-flight save so a concurrent "Use profile
                  // answers" revert on the same field can wait for it and
                  // write last, rather than racing it (see revert loop).
                  pendingSavesRef?.current.set(question.id, save);
                  try {
                    await save;
                  } finally {
                    if (pendingSavesRef?.current.get(question.id) === save)
                      pendingSavesRef.current.delete(question.id);
                  }
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
  positionQuestions: PositionWithQuestions['questions'];
}

export function ApplicationStepper({
  application,
  globalQuestions,
  globalAnswers,
  positionQuestions,
}: ApplicationStepperProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [missingGlobalIds, setMissingGlobalIds] = useState<Set<string>>(
    new Set(),
  );
  const hasPositionQuestions = positionQuestions.length > 0;
  // Keyed by question id — see QuestionListProps.pendingSavesRef.
  const pendingSavesRef = useRef<Map<string, Promise<unknown>>>(new Map());

  const {
    control,
    trigger,
    setValue,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<StepperFormValues>({
    defaultValues: Object.fromEntries([
      ...globalQuestions.map((q) => {
        const appAnswer = application.globalAnswers.find(
          (a: GlobalApplicationAnswer) => a.globalQuestionId === q.id,
        );
        const profileAnswer = globalAnswers.find(
          (a: GlobalAnswer) => a.globalQuestionId === q.id,
        );
        const value =
          toStringArray(appAnswer?.value).length > 0
            ? toStringArray(appAnswer?.value)
            : toStringArray(profileAnswer?.value);
        return [`g_${q.id}`, value];
      }),
      ...positionQuestions.map((q) => {
        const value = toStringArray(
          application.positionAnswers.find(
            (a: PositionApplicationAnswer) => a.positionQuestionId === q.id,
          )?.value,
        );
        return [`p_${q.id}`, value];
      }),
    ]),
  });

  async function handleNext() {
    if (isCustomizing) {
      const valid = await trigger(globalQuestions.map((q) => `g_${q.id}`));
      if (!valid) return;
      setMissingGlobalIds(new Set());
      clearErrors('root');
      setStep(2);
      return;
    }

    // Read-only mode never registers Controllers for global fields, so
    // `trigger` can't validate them — check required-ness against the
    // profile's actual answers instead.
    const missing = new Set(
      globalQuestions
        .filter(
          (q) =>
            q.required &&
            toStringArray(
              globalAnswers.find(
                (a: GlobalAnswer) => a.globalQuestionId === q.id,
              )?.value,
            ).length === 0,
        )
        .map((q) => q.id),
    );

    if (missing.size > 0) {
      setMissingGlobalIds(missing);
      setError('root', {
        message:
          'Please answer all required profile questions before continuing. Click Customize to add them here, or update your profile.',
      });
      return;
    }

    setMissingGlobalIds(new Set());
    clearErrors('root');
    setStep(2);
  }

  const watchedValues = useWatch({ control }) as StepperFormValues;

  async function handleToggleCustomize() {
    if (!isCustomizing) {
      setIsCustomizing(true);
      setMissingGlobalIds(new Set());
      clearErrors('root');
      return;
    }

    setIsReverting(true);
    try {
      const results = await Promise.all(
        globalQuestions.map(async (q) => {
          const profileValue = toStringArray(
            globalAnswers.find((a: GlobalAnswer) => a.globalQuestionId === q.id)
              ?.value,
          );
          const current = toStringArray(watchedValues[`g_${q.id}`]);
          if (JSON.stringify(current) === JSON.stringify(profileValue))
            return null;

          // Let any blur-triggered autosave already in flight for this field
          // settle first, so the revert write is issued last and the value
          // that ends up persisted matches what we're about to display.
          const pending = pendingSavesRef.current.get(q.id);
          if (pending) await pending.catch(() => {});

          const result = await createOrUpdateApplicationAnswer({
            applicationId: application.id,
            questionId: q.id,
            questionLabel: q.label,
            value: profileValue,
            isGlobal: true,
          });
          // Only reflect the revert in the form once it's actually persisted —
          // a failed field keeps whatever was last successfully saved rather
          // than showing a value the server never accepted.
          if (!isError(result)) setValue(`g_${q.id}`, profileValue);
          return result;
        }),
      );

      const hasError = results.some((r) => r !== null && isError(r));
      if (hasError) toast.error('Failed to revert some answers');
      else toast.success('Reverted to profile answers');
    } catch {
      toast.error('Failed to revert some answers');
    } finally {
      setIsReverting(false);
      setIsCustomizing(false);
    }
  }

  const onSubmit = handleSubmit(async () => {
    const result = await submitApplication(application.id);
    if (isError(result)) {
      setError('root', { message: result.error });
      toast.error(result.error);
    } else {
      toast.success('Application submitted');
      router.push('/applications');
    }
  });

  return (
    <div className="flex flex-col gap-6">
      {hasPositionQuestions && (
        <div role="list" className="flex items-center gap-2">
          <div
            role="listitem"
            aria-current={step === 1 ? 'step' : undefined}
            className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-full text-sm font-medium"
          >
            {step === 2 ? <CheckIcon className="size-4" /> : '1'}
          </div>
          <div className="bg-border h-px flex-1" />
          <div
            role="listitem"
            aria-current={step === 2 ? 'step' : undefined}
            className={cn(
              'flex size-7 items-center justify-center rounded-full text-sm font-medium',
              step === 2
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground',
            )}
          >
            2
          </div>
        </div>
      )}

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
              onClick={handleToggleCustomize}
              disabled={isReverting}
            >
              {isCustomizing
                ? isReverting
                  ? 'Reverting...'
                  : 'Use profile answers'
                : 'Customize'}
            </Button>
          </div>

          {isCustomizing && (
            <div className="border-warning/40 bg-warning/10 text-warning-foreground rounded-lg border p-3 text-sm">
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
            readOnly={!isCustomizing}
            profileAnswers={globalAnswers}
            formValues={watchedValues}
            missingGlobalIds={missingGlobalIds}
            pendingSavesRef={pendingSavesRef}
          />

          {errors.root && (
            <p className="text-destructive text-sm">{errors.root.message}</p>
          )}

          <div className="flex justify-end">
            <Button
              onClick={hasPositionQuestions ? handleNext : onSubmit}
              disabled={!hasPositionQuestions && isSubmitting}
            >
              {hasPositionQuestions
                ? 'Next'
                : isSubmitting
                  ? 'Submitting...'
                  : 'Submit Application'}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && hasPositionQuestions && (
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
