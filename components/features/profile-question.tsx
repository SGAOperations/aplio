'use client';

import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { toast } from 'sonner';

import { updateGlobalAnswer } from '@/prisma/actions/profile';
import type { GlobalAnswer, GlobalQuestion } from '@/prisma/client';

import {
  ANSWER_LONG_MAX_LENGTH,
  ANSWER_OTHER_MAX_LENGTH,
  ANSWER_SHORT_MAX_LENGTH,
  OTHER_OPTION_LABEL,
  OTHER_OPTION_VALUE,
  SHORT_ANSWER_FORMAT_ERROR_MESSAGES,
  getAnswerValueError,
  matchesShortAnswerFormat,
} from '@/lib/constants';
import { ActionError, cn, isError, partitionAnswerValue } from '@/lib/utils';

import { AnswerFileLink } from '@/components/features/answer-file-link';
import { AnswerMismatchNotice } from '@/components/features/answer-mismatch-notice';
import { QuestionCardLabel } from '@/components/features/question-card-label';
import { QuestionFileField } from '@/components/features/question-file-field';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';

interface ProfileQuestionProps {
  question: GlobalQuestion;
  answer: GlobalAnswer | null;
  isEditing: boolean;
}

export function ProfileQuestion({
  question,
  answer,
  isEditing,
}: ProfileQuestionProps) {
  const initialValue = (
    Array.isArray(answer?.value) ? answer.value : []
  ) as string[];
  const { control, getValues, reset } = useForm<{ value: string[] }>({
    defaultValues: { value: initialValue },
  });
  // Tracks the last saved serialized value to avoid redundant server calls.
  const savedValueRef = useRef(JSON.stringify(initialValue));
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const noticeId = `${question.id}-mismatch`;
  const labelId = `${question.id}-label`;
  const inputId = `${question.id}-input`;
  const errorId = `${question.id}-error`;

  // Non-reactive to typing; fine here — the editable view below recomputes.
  const { fitted: viewFitted, orphaned: viewOrphaned } = partitionAnswerValue(
    question,
    getValues('value'),
  );

  // Gated on allowOther — a turned-off option can't masquerade as "Other".
  const initialOtherValue = question.allowOther
    ? viewFitted.find((v) => !question.options.includes(v))
    : undefined;
  const [otherSelected, setOtherSelected] = useState(
    initialOtherValue !== undefined,
  );
  const [otherText, setOtherText] = useState(initialOtherValue ?? '');

  async function save(value: string[]) {
    const serialized = JSON.stringify(value);
    if (serialized === savedValueRef.current) {
      setSaveError(false);
      return;
    }
    setIsSaving(true);
    setSaveError(false);
    try {
      const result = await updateGlobalAnswer(question.id, value);
      if (isError(result)) throw new ActionError(result.error);
      savedValueRef.current = serialized;
      reset({ value });
    } catch (err) {
      // savedValueRef is not advanced on failure so retries work
      setSaveError(true);
      // Non-ActionError throws (e.g. an auth guard) must never surface their raw message.
      toast.error(
        err instanceof ActionError ? err.message : 'Failed to save answer',
      );
    } finally {
      setIsSaving(false);
    }
  }

  // This autosave fails silently, so blocking here is the only way the user sees it.
  function handleBlur() {
    const value = getValues('value');
    // Orphaned values are read-only elsewhere — only fitted needs format-validating.
    const { fitted } = partitionAnswerValue(question, value);
    if (
      question.type === 'short_answer' &&
      question.format &&
      fitted[0] &&
      !matchesShortAnswerFormat(fitted[0], question.format)
    ) {
      setValidationError(SHORT_ANSWER_FORMAT_ERROR_MESSAGES[question.format]);
      return;
    }
    const answerError = getAnswerValueError(question, value);
    if (answerError) {
      setValidationError(answerError);
      return;
    }
    setValidationError(null);
    save(value);
  }

  return (
    <div className="bg-card rounded-lg border p-4 shadow-sm">
      <QuestionCardLabel
        id={labelId}
        label={question.label}
        required={question.required}
        htmlFor={
          isEditing &&
          (question.type === 'short_answer' || question.type === 'long_answer')
            ? inputId
            : undefined
        }
      />

      {/* Full stored value, read-only — not writable, so a mismatch can't round-trip into a write. */}
      {!isEditing && viewOrphaned.length > 0 && (
        <AnswerMismatchNotice
          id={noticeId}
          values={viewOrphaned}
          questionType={question.type}
        />
      )}

      {!isEditing &&
        (getValues('value').length === 0 ? (
          <p className="text-muted-foreground text-sm italic">No answer yet</p>
        ) : question.type === 'file_upload' ? (
          <AnswerFileLink
            target={{ scope: 'profile', questionId: question.id }}
            url={getValues('value')[0]}
          />
        ) : question.type === 'multiple_choice' ? (
          <div className="flex flex-wrap gap-1.5">
            {getValues('value').map((v) => (
              <span
                key={v}
                className="bg-primary/10 text-primary rounded-md px-2 py-0.5 text-sm font-medium"
              >
                {v}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-foreground text-base font-medium">
            {getValues('value')[0] ?? 'No answer yet'}
          </p>
        ))}

      {isEditing && (
        <Controller
          control={control}
          name="value"
          render={({ field }) => {
            const { fitted, orphaned } = partitionAnswerValue(
              question,
              field.value,
            );
            const notice = orphaned.length > 0 && (
              <AnswerMismatchNotice
                id={noticeId}
                values={orphaned}
                questionType={question.type}
              />
            );

            const describedBy =
              [orphaned.length > 0 && noticeId, validationError && errorId]
                .filter((v): v is string => Boolean(v))
                .join(' ') || undefined;

            if (question.type === 'short_answer')
              return (
                <>
                  {notice}
                  <Input
                    id={inputId}
                    value={fitted[0] ?? ''}
                    onChange={(e) => {
                      field.onChange(e.target.value ? [e.target.value] : []);
                      setValidationError(null);
                    }}
                    onBlur={handleBlur}
                    maxLength={ANSWER_SHORT_MAX_LENGTH}
                    aria-required={question.required}
                    aria-invalid={!!validationError}
                    aria-describedby={describedBy}
                  />
                </>
              );

            if (question.type === 'long_answer')
              return (
                <>
                  {notice}
                  <Textarea
                    id={inputId}
                    value={fitted[0] ?? ''}
                    onChange={(e) => {
                      field.onChange(e.target.value ? [e.target.value] : []);
                      setValidationError(null);
                    }}
                    onBlur={handleBlur}
                    className="min-h-[100px]"
                    maxLength={ANSWER_LONG_MAX_LENGTH}
                    aria-required={question.required}
                    aria-invalid={!!validationError}
                    aria-describedby={[
                      describedBy,
                      `${question.id}-long-answer-count`,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  />
                  <p
                    id={`${question.id}-long-answer-count`}
                    className={cn(
                      'text-muted-foreground mt-1 text-right text-xs',
                      (fitted[0]?.length ?? 0) >= ANSWER_LONG_MAX_LENGTH &&
                        'text-destructive',
                    )}
                  >
                    {(fitted[0]?.length ?? 0).toLocaleString()}/
                    {ANSWER_LONG_MAX_LENGTH.toLocaleString()}
                  </p>
                </>
              );

            if (question.type === 'single_choice')
              return (
                <div className="flex flex-col gap-2">
                  {notice}
                  <RadioGroup
                    aria-labelledby={labelId}
                    aria-required={question.required}
                    aria-describedby={
                      orphaned.length > 0 ? noticeId : undefined
                    }
                    value={
                      otherSelected ? OTHER_OPTION_VALUE : (fitted[0] ?? '')
                    }
                    onValueChange={(v) => {
                      if (v === OTHER_OPTION_VALUE) {
                        setOtherSelected(true);
                        const next = otherText ? [otherText] : [];
                        field.onChange(next);
                        save(next);
                        return;
                      }
                      // Clearing the typed text stops it being silently resubmitted.
                      setOtherSelected(false);
                      setOtherText('');
                      field.onChange([v]);
                      save([v]);
                    }}
                  >
                    {question.options.map((option: string, i: number) => (
                      <div
                        key={option}
                        className="flex cursor-pointer items-center gap-2 py-1"
                      >
                        <RadioGroupItem
                          value={option}
                          id={`${question.id}-${i}`}
                        />
                        <Label
                          htmlFor={`${question.id}-${i}`}
                          className="cursor-pointer text-sm font-normal"
                        >
                          {option}
                        </Label>
                      </div>
                    ))}

                    {question.allowOther && (
                      <div className="flex cursor-pointer items-center gap-2 py-1">
                        <RadioGroupItem
                          value={OTHER_OPTION_VALUE}
                          id={`${question.id}-other`}
                        />
                        <Label
                          htmlFor={`${question.id}-other`}
                          className="cursor-pointer text-sm font-normal"
                        >
                          {OTHER_OPTION_LABEL}
                        </Label>
                      </div>
                    )}
                  </RadioGroup>

                  {question.allowOther && otherSelected && (
                    <div className="ml-6 flex flex-col gap-1">
                      <Label
                        id={`${question.id}-other-label`}
                        htmlFor={`${question.id}-other-text`}
                        className="text-muted-foreground text-xs font-normal"
                      >
                        {OTHER_OPTION_LABEL}
                        {question.required && (
                          <span className="text-destructive ml-1">*</span>
                        )}
                      </Label>
                      <Input
                        id={`${question.id}-other-text`}
                        value={otherText}
                        onChange={(e) => {
                          setOtherText(e.target.value);
                          field.onChange(
                            e.target.value ? [e.target.value] : [],
                          );
                        }}
                        onBlur={handleBlur}
                        aria-labelledby={`${labelId} ${question.id}-other-label`}
                        maxLength={ANSWER_OTHER_MAX_LENGTH}
                      />
                    </div>
                  )}
                </div>
              );

            if (question.type === 'file_upload')
              return (
                <>
                  {notice}
                  <QuestionFileField
                    target={{ scope: 'profile', questionId: question.id }}
                    value={fitted}
                    onChange={(v) => {
                      // Already persisted server-side — sync local state only, never save().
                      field.onChange(v);
                      savedValueRef.current = JSON.stringify(v);
                      reset({ value: v });
                    }}
                    labelledBy={labelId}
                  />
                </>
              );

            // question.type === 'multiple_choice'
            return (
              <div
                role="group"
                aria-labelledby={labelId}
                aria-describedby={orphaned.length > 0 ? noticeId : undefined}
                className="flex flex-col gap-2"
              >
                {notice}
                {question.options.map((option: string, i: number) => (
                  <div
                    key={option}
                    className="flex cursor-pointer items-center gap-2 py-1"
                  >
                    <Checkbox
                      id={`${question.id}-${i}`}
                      checked={fitted.includes(option)}
                      onCheckedChange={() => {
                        const next = fitted.includes(option)
                          ? fitted.filter((v) => v !== option)
                          : [...fitted, option];
                        field.onChange(next);
                        save(next);
                      }}
                    />
                    <Label
                      htmlFor={`${question.id}-${i}`}
                      className="cursor-pointer text-sm font-normal"
                    >
                      {option}
                    </Label>
                  </div>
                ))}

                {question.allowOther && (
                  <div className="flex cursor-pointer items-center gap-2 py-1">
                    <Checkbox
                      id={`${question.id}-other`}
                      checked={otherSelected}
                      onCheckedChange={(checked) => {
                        setOtherSelected(!!checked);
                        const checkedOptions = fitted.filter((v) =>
                          question.options.includes(v),
                        );
                        if (checked) {
                          const next = otherText
                            ? [...checkedOptions, otherText]
                            : checkedOptions;
                          field.onChange(next);
                          save(next);
                        } else {
                          // Drops the typed text immediately, so it isn't resubmitted.
                          setOtherText('');
                          field.onChange(checkedOptions);
                          save(checkedOptions);
                        }
                      }}
                    />
                    <Label
                      htmlFor={`${question.id}-other`}
                      className="cursor-pointer text-sm font-normal"
                    >
                      {OTHER_OPTION_LABEL}
                    </Label>
                  </div>
                )}

                {question.allowOther && otherSelected && (
                  <div className="ml-6 flex flex-col gap-1">
                    <Label
                      id={`${question.id}-other-label`}
                      htmlFor={`${question.id}-other-text`}
                      className="text-muted-foreground text-xs font-normal"
                    >
                      {OTHER_OPTION_LABEL}
                      {question.required && (
                        <span className="text-destructive ml-1">*</span>
                      )}
                    </Label>
                    <Input
                      id={`${question.id}-other-text`}
                      value={otherText}
                      onChange={(e) => {
                        setOtherText(e.target.value);
                        const checkedOptions = fitted.filter((v) =>
                          question.options.includes(v),
                        );
                        field.onChange(
                          e.target.value
                            ? [...checkedOptions, e.target.value]
                            : checkedOptions,
                        );
                      }}
                      onBlur={handleBlur}
                      aria-labelledby={`${labelId} ${question.id}-other-label`}
                      maxLength={ANSWER_OTHER_MAX_LENGTH}
                    />
                  </div>
                )}
              </div>
            );
          }}
        />
      )}

      {isEditing && validationError && (
        <p id={errorId} className="text-destructive mt-2 text-xs">
          {validationError}
        </p>
      )}
      {isEditing && isSaving && (
        <span className="text-muted-foreground mt-2 block text-xs">
          Saving...
        </span>
      )}
      {isEditing && saveError && (
        <p className="text-destructive mt-2 text-xs">
          Failed to save. Please try again.
        </p>
      )}
    </div>
  );
}
