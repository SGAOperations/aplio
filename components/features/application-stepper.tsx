'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type RefObject, useMemo, useRef, useState } from 'react';
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

import {
  SHORT_ANSWER_FORMAT_ERROR_MESSAGES,
  getAnswerValueError,
  matchesShortAnswerFormat,
} from '@/lib/constants';
import {
  type AnswerQuestion,
  type DraftApplication,
  type PositionWithQuestions,
  type QuestionFileTarget,
} from '@/lib/types';
import {
  ActionError,
  type ErrorType,
  cn,
  isAnswered,
  isError,
  partitionAnswerValue,
  toStringArray,
} from '@/lib/utils';

import { AnswerFileLink } from '@/components/features/answer-file-link';
import { AnswerMismatchNotice } from '@/components/features/answer-mismatch-notice';
import { ApplicationQuestion } from '@/components/features/application-question';
import { QuestionCardLabel } from '@/components/features/question-card-label';
import { Button } from '@/components/ui/button';
import { WarningCallout } from '@/components/ui/warning-callout';

type StepperFormValues = Record<string, string[]>;

interface QuestionListProps {
  applicationId: string;
  questions: AnswerQuestion[];
  control: Control<StepperFormValues>;
  isGlobal: boolean;
  readOnly?: boolean;
  profileAnswers?: GlobalAnswer[];
  formValues?: StepperFormValues;
  missingGlobalIds?: Set<string>;
  // Keyed by question id: lets a profile-answers revert wait on an in-flight autosave.
  pendingSavesRef?: RefObject<Map<string, Promise<unknown>>>;
}

function ReadOnlyQuestionCard({
  question,
  displayValue,
  isMissing,
}: {
  question: AnswerQuestion;
  displayValue: string[];
  isMissing?: boolean;
}) {
  // Read-only — full stored value renders as-is; the notice just flags the mismatch.
  const { orphaned } = partitionAnswerValue(question, displayValue);

  return (
    <div
      className={cn(
        'bg-card rounded-lg border p-4 shadow-sm',
        isMissing && 'border-destructive',
      )}
    >
      <QuestionCardLabel
        id={`${question.id}-label`}
        label={question.label}
        required={question.required}
      />
      {orphaned.length > 0 && (
        <AnswerMismatchNotice
          id={`${question.id}-mismatch`}
          values={orphaned}
          questionType={question.type}
        />
      )}
      {displayValue.length === 0 ? (
        <p className="text-muted-foreground text-sm italic">No answer yet</p>
      ) : question.type === 'file_upload' ? (
        // Read-only shows the profile's own answer, so the target is profile-scoped.
        <AnswerFileLink
          target={{ scope: 'profile', questionId: question.id }}
          url={displayValue[0] ?? ''}
        />
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
            // Position fields validate here; globals go through checkGlobalReadiness.
            rules={
              isGlobal
                ? undefined
                : {
                    validate: (value) => {
                      const arr = toStringArray(value);
                      if (question.required && !isAnswered(question, arr)) {
                        // Distinguish never-answered from answered-but-no-longer-fits.
                        const { orphaned } = partitionAnswerValue(
                          question,
                          arr,
                        );
                        return orphaned.length > 0
                          ? 'Please answer this question again'
                          : 'This field is required';
                      }
                      if (
                        question.type === 'short_answer' &&
                        question.format &&
                        arr[0] &&
                        !matchesShortAnswerFormat(arr[0], question.format)
                      )
                        return SHORT_ANSWER_FORMAT_ERROR_MESSAGES[
                          question.format
                        ];
                      // Mirrors the server check in createOrUpdateApplicationAnswer.
                      return getAnswerValueError(question, arr) ?? true;
                    },
                  }
            }
            render={({ field, fieldState }) => (
              <ApplicationQuestion
                question={question}
                field={field}
                // Falls back to missingGlobalIds so an unfocused required field still errors on Next/Submit.
                error={
                  fieldState.error?.message ??
                  (missingGlobalIds?.has(question.id)
                    ? 'This field is required'
                    : undefined)
                }
                fileTarget={
                  {
                    scope: 'application',
                    applicationId,
                    questionId: question.id,
                    isGlobal,
                  } satisfies QuestionFileTarget
                }
                onSave={async (value) => {
                  const save = (async () => {
                    const result = await createOrUpdateApplicationAnswer({
                      applicationId,
                      questionId: question.id,
                      value,
                    });
                    if (isError(result)) throw new ActionError(result.error);
                  })();
                  // Tracked so a concurrent revert on this field waits rather than races it.
                  pendingSavesRef?.current.set(question.id, save);
                  try {
                    return await save;
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
  const [isReverting, setIsReverting] = useState(false);
  // isSubmitting resets before the un-awaited redirect lands, so this keeps Submit disabled.
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [missingGlobalIds, setMissingGlobalIds] = useState<Set<string>>(
    new Set(),
  );
  const hasPositionQuestions = positionQuestions.length > 0;
  const isResubmit = application.status === 'withdrawn';
  // Keyed by question id — see QuestionListProps.pendingSavesRef.
  const pendingSavesRef = useRef<Map<string, Promise<unknown>>>(new Map());

  // Branches on row presence, not value length — an existing but empty
  // row is a deliberate clear, must stay empty, unlike a missing row.
  const initialGlobalValues = useMemo(
    () =>
      Object.fromEntries(
        globalQuestions.map((q) => {
          const appAnswer = application.globalAnswers.find(
            (a: GlobalApplicationAnswer) => a.globalQuestionId === q.id,
          );
          const profileAnswer = globalAnswers.find(
            (a: GlobalAnswer) => a.globalQuestionId === q.id,
          );
          const value = appAnswer
            ? toStringArray(appAnswer.value)
            : toStringArray(profileAnswer?.value);
          return [`g_${q.id}`, value];
        }),
      ),
    [globalQuestions, globalAnswers, application.globalAnswers],
  );

  // Row ids only, so presence (not value emptiness) drives hasNewRequiredGlobals.
  const hasGlobalRow = useMemo(
    () =>
      new Set(
        application.globalAnswers.map(
          (a: GlobalApplicationAnswer) => a.globalQuestionId,
        ),
      ),
    [application.globalAnswers],
  );

  const initialPositionValues = useMemo(
    () =>
      Object.fromEntries(
        positionQuestions.map((q) => [
          `p_${q.id}`,
          toStringArray(
            application.positionAnswers.find(
              (a: PositionApplicationAnswer) => a.positionQuestionId === q.id,
            )?.value,
          ),
        ]),
      ),
    [positionQuestions, application.positionAnswers],
  );

  // True only for a question with no row at all — a cleared answer already has one.
  const hasNewRequiredGlobals = useMemo(
    () => globalQuestions.some((q) => q.required && !hasGlobalRow.has(q.id)),
    [globalQuestions, hasGlobalRow],
  );

  const [isCustomizing, setIsCustomizing] = useState(hasNewRequiredGlobals);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    getValues,
    trigger,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<StepperFormValues>({
    // Surfaces required/format errors on blur, not only on submit.
    mode: 'onBlur',
    defaultValues: { ...initialGlobalValues, ...initialPositionValues },
  });

  // Shared by Next and Submit so neither can advance past an empty required global.
  function checkGlobalReadiness(): boolean {
    const values = getValues();
    const missing = new Set(
      globalQuestions
        .filter(
          (q) =>
            q.required && !isAnswered(q, toStringArray(values[`g_${q.id}`])),
        )
        .map((q) => q.id),
    );

    if (missing.size > 0) {
      setMissingGlobalIds(missing);
      setIsCustomizing(true);
      setStep(1);
      setError('root', {
        message: 'Answer the highlighted required questions before continuing.',
      });
      return false;
    }

    setMissingGlobalIds(new Set());
    clearErrors('root');
    return true;
  }

  function handleNext() {
    if (!checkGlobalReadiness()) return;
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

          // Waits for an in-flight autosave so the revert write lands last.
          const pending = pendingSavesRef.current.get(q.id);
          if (pending) await pending.catch(() => {});

          const result = await createOrUpdateApplicationAnswer({
            applicationId: application.id,
            questionId: q.id,
            value: profileValue,
          });
          // Applied only once persisted: a failed field keeps its last saved value.
          if (!isError(result)) setValue(`g_${q.id}`, profileValue);
          return result;
        }),
      );

      // Surface a specific refusal verbatim, same as onSave/blur.
      const firstError = results.find(
        (r): r is ErrorType => r !== null && isError(r),
      );
      if (firstError) toast.error(firstError.error);
      else toast.success('Reverted to profile answers');
    } catch {
      toast.error('Failed to revert some answers');
    } finally {
      setIsReverting(false);
      setIsCustomizing(false);
    }
  }

  async function onSubmit() {
    // No-op when there are no position questions — only step-2 fields are registered.
    const validPosition = await trigger(
      positionQuestions.map((q) => `p_${q.id}`),
    );
    if (!validPosition) return;

    if (!checkGlobalReadiness()) return;

    setIsSubmitting(true);
    try {
      // Lets an unblurred field's own autosave land before the server reads the snapshot.
      await Promise.allSettled([...pendingSavesRef.current.values()]);

      const result = await submitApplication(application.id);
      if (isError(result)) {
        setError('root', { message: result.error });
        toast.error(result.error);
      } else {
        toast.success(
          isResubmit ? 'Application resubmitted' : 'Application submitted',
        );
        setIsRedirecting(true);
        router.replace(`/my-applications/${application.id}`);
      }
    } catch (error) {
      console.error(error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

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
              onClick={() => void handleToggleCustomize()}
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
            <WarningCallout>
              {hasNewRequiredGlobals && (
                <p className="mb-1 font-medium">
                  New required profile questions were added since you started
                  this application. Answer them below to continue.
                </p>
              )}
              These answers are saved for this application only. To update your
              answers permanently, visit your{' '}
              <Link href="/profile" className="font-medium underline">
                profile page
              </Link>
              .
            </WarningCallout>
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
            <p role="alert" className="text-destructive text-sm">
              {errors.root.message}
            </p>
          )}

          <div className="flex justify-end">
            <Button
              onClick={hasPositionQuestions ? handleNext : onSubmit}
              disabled={
                !hasPositionQuestions && (isSubmitting || isRedirecting)
              }
            >
              {hasPositionQuestions
                ? 'Next'
                : isSubmitting || isRedirecting
                  ? isResubmit
                    ? 'Resubmitting...'
                    : 'Submitting...'
                  : isResubmit
                    ? 'Resubmit Application'
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
            <p role="alert" className="text-destructive text-sm">
              {errors.root.message}
            </p>
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
            <Button
              onClick={() => void onSubmit()}
              disabled={isSubmitting || isRedirecting}
            >
              {isSubmitting || isRedirecting
                ? isResubmit
                  ? 'Resubmitting...'
                  : 'Submitting...'
                : isResubmit
                  ? 'Resubmit Application'
                  : 'Submit Application'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
