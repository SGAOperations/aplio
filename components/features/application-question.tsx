'use client';

import { useRef, useState } from 'react';

import { toast } from 'sonner';

import {
  ANSWER_LONG_MAX_LENGTH,
  ANSWER_OTHER_MAX_LENGTH,
  ANSWER_SHORT_MAX_LENGTH,
  FORMAT_INPUT_TYPES,
  OTHER_OPTION_LABEL,
  getAnswerValueError,
  matchesShortAnswerFormat,
} from '@/lib/constants';
import type { AnswerQuestion, QuestionFileTarget } from '@/lib/types';
import {
  ActionError,
  cn,
  composeDescribedBy,
  partitionAnswerValue,
} from '@/lib/utils';

import { AnswerMismatchNotice } from '@/components/features/answer-mismatch-notice';
import { QuestionCardLabel } from '@/components/features/question-card-label';
import { QuestionFileField } from '@/components/features/question-file-field';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ApplicationQuestionProps {
  question: AnswerQuestion;
  field: {
    value: string[];
    onChange: (value: string[]) => void;
    onBlur: () => void;
  };
  error?: string;
  onSave: (value: string[]) => Promise<void>;
  // file_upload only: QuestionFileField calls the file actions directly.
  fileTarget: QuestionFileTarget;
}

export function ApplicationQuestion({
  question,
  field,
  error,
  onSave,
  fileTarget,
}: ApplicationQuestionProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  // Raw value, never re-seeded — an untouched blur must write nothing.
  const savedValueRef = useRef(JSON.stringify(field.value));
  const options = Array.isArray(question.options)
    ? question.options.filter((o): o is string => typeof o === 'string')
    : [];
  const { fitted, orphaned } = partitionAnswerValue(question, field.value);
  const noticeId = `${question.id}-mismatch`;
  const labelId = `${question.id}-label`;
  const inputId = `${question.id}-input`;
  const errorId = `${question.id}-error`;
  const describedBy = composeDescribedBy(
    orphaned.length > 0 && noticeId,
    error && errorId,
  );

  // Gated on allowOther — a turned-off option can't masquerade as "Other".
  const initialOtherValue = question.allowOther
    ? fitted.find((v) => !options.includes(v))
    : undefined;
  const [otherSelected, setOtherSelected] = useState(
    initialOtherValue !== undefined,
  );
  const [otherText, setOtherText] = useState(initialOtherValue ?? '');

  async function save(value: string[]) {
    const serialized = JSON.stringify(value);
    if (serialized === savedValueRef.current) return;
    setIsSaving(true);
    setSaveError(false);
    try {
      await onSave(value);
      savedValueRef.current = serialized;
    } catch (err) {
      setSaveError(true);
      // Non-ActionError throws (e.g. an auth guard) must never surface their raw message.
      toast.error(
        err instanceof ActionError ? err.message : 'Failed to save answer',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBlur() {
    field.onBlur();
    // Skip the autosave on a format failure, or the inline error gets a toast too.
    if (
      question.type === 'short_answer' &&
      question.format &&
      field.value[0] &&
      !matchesShortAnswerFormat(field.value[0], question.format)
    )
      return;
    if (getAnswerValueError(question, field.value)) return;
    await save(field.value);
  }

  return (
    <div
      className={cn(
        'bg-card rounded-lg border p-4 shadow-sm',
        error && 'border-destructive',
      )}
    >
      <QuestionCardLabel
        id={labelId}
        label={question.label}
        required={question.required}
        htmlFor={
          question.type === 'short_answer' || question.type === 'long_answer'
            ? inputId
            : undefined
        }
      />

      {orphaned.length > 0 && (
        <AnswerMismatchNotice
          id={noticeId}
          values={orphaned}
          questionType={question.type}
        />
      )}

      {question.type === 'short_answer' && (
        <Input
          id={inputId}
          type={question.format ? FORMAT_INPUT_TYPES[question.format] : 'text'}
          value={fitted[0] ?? ''}
          onChange={(e) =>
            field.onChange(e.target.value ? [e.target.value] : [])
          }
          onBlur={() => void handleBlur()}
          maxLength={ANSWER_SHORT_MAX_LENGTH}
          aria-required={question.required}
          aria-invalid={!!error}
          aria-describedby={describedBy}
        />
      )}

      {question.type === 'long_answer' && (
        <>
          <Textarea
            id={inputId}
            value={fitted[0] ?? ''}
            onChange={(e) =>
              field.onChange(e.target.value ? [e.target.value] : [])
            }
            onBlur={() => void handleBlur()}
            className="min-h-[120px]"
            maxLength={ANSWER_LONG_MAX_LENGTH}
            aria-required={question.required}
            aria-invalid={!!error}
            aria-describedby={composeDescribedBy(
              describedBy,
              `${question.id}-long-answer-count`,
            )}
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
      )}

      {question.type === 'single_choice' && (
        <div
          role="radiogroup"
          aria-labelledby={labelId}
          aria-required={question.required}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className="flex flex-col gap-2"
        >
          {options.map((option) => (
            <Label
              key={option}
              className="flex cursor-pointer items-center gap-2 font-normal"
            >
              <input
                type="radio"
                name={question.id}
                value={option}
                checked={!otherSelected && fitted[0] === option}
                onChange={() => {
                  // Clearing the typed text stops it being silently resubmitted.
                  setOtherSelected(false);
                  setOtherText('');
                  field.onChange([option]);
                  void save([option]);
                }}
                className="accent-primary size-4"
              />
              {option}
            </Label>
          ))}

          {question.allowOther && (
            <>
              <Label className="flex cursor-pointer items-center gap-2 font-normal">
                <input
                  type="radio"
                  name={question.id}
                  value={OTHER_OPTION_LABEL}
                  checked={otherSelected}
                  onChange={() => {
                    setOtherSelected(true);
                    const next = otherText ? [otherText] : [];
                    field.onChange(next);
                    void save(next);
                  }}
                  className="accent-primary size-4"
                />
                {OTHER_OPTION_LABEL}
              </Label>

              {otherSelected && (
                <div className="ml-6 flex flex-col gap-1">
                  <Label
                    id={`${question.id}-other-label`}
                    htmlFor={`${question.id}-other`}
                    className="text-muted-foreground text-xs font-normal"
                  >
                    {OTHER_OPTION_LABEL}
                    {question.required && (
                      <span className="text-destructive ml-1">*</span>
                    )}
                  </Label>
                  <Input
                    id={`${question.id}-other`}
                    value={otherText}
                    onChange={(e) => {
                      setOtherText(e.target.value);
                      field.onChange(e.target.value ? [e.target.value] : []);
                    }}
                    onBlur={() => void handleBlur()}
                    aria-labelledby={`${labelId} ${question.id}-other-label`}
                    maxLength={ANSWER_OTHER_MAX_LENGTH}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {question.type === 'multiple_choice' && (
        <div
          role="group"
          aria-labelledby={labelId}
          aria-describedby={describedBy}
          className="flex flex-col gap-2"
        >
          {options.map((option) => (
            <Label
              key={option}
              className="flex cursor-pointer items-center gap-2 font-normal"
            >
              <Checkbox
                checked={fitted.includes(option)}
                onCheckedChange={(checked) => {
                  const next = checked
                    ? [...fitted, option]
                    : fitted.filter((v) => v !== option);
                  field.onChange(next);
                  void save(next);
                }}
              />
              {option}
            </Label>
          ))}

          {question.allowOther && (
            <>
              <Label className="flex cursor-pointer items-center gap-2 font-normal">
                <Checkbox
                  checked={otherSelected}
                  onCheckedChange={(checked) => {
                    setOtherSelected(!!checked);
                    const checkedOptions = fitted.filter((v) =>
                      options.includes(v),
                    );
                    if (checked) {
                      const next = otherText
                        ? [...checkedOptions, otherText]
                        : checkedOptions;
                      field.onChange(next);
                      void save(next);
                    } else {
                      // Drops the typed text immediately, so it isn't resubmitted.
                      setOtherText('');
                      field.onChange(checkedOptions);
                      void save(checkedOptions);
                    }
                  }}
                />
                {OTHER_OPTION_LABEL}
              </Label>

              {otherSelected && (
                <div className="ml-6 flex flex-col gap-1">
                  <Label
                    id={`${question.id}-other-label`}
                    htmlFor={`${question.id}-other`}
                    className="text-muted-foreground text-xs font-normal"
                  >
                    {OTHER_OPTION_LABEL}
                    {question.required && (
                      <span className="text-destructive ml-1">*</span>
                    )}
                  </Label>
                  <Input
                    id={`${question.id}-other`}
                    value={otherText}
                    onChange={(e) => {
                      setOtherText(e.target.value);
                      const checkedOptions = fitted.filter((v) =>
                        options.includes(v),
                      );
                      field.onChange(
                        e.target.value
                          ? [...checkedOptions, e.target.value]
                          : checkedOptions,
                      );
                    }}
                    onBlur={() => void handleBlur()}
                    aria-labelledby={`${labelId} ${question.id}-other-label`}
                    maxLength={ANSWER_OTHER_MAX_LENGTH}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {question.type === 'file_upload' && (
        <QuestionFileField
          target={fileTarget}
          value={fitted}
          onChange={field.onChange}
          labelledBy={labelId}
        />
      )}

      {error && (
        <p id={errorId} className="text-destructive mt-2 text-xs">
          {error}
        </p>
      )}
      {isSaving && (
        <span className="text-muted-foreground mt-2 block text-xs">
          Saving...
        </span>
      )}
      {saveError && (
        <p className="text-destructive mt-2 text-xs">
          Failed to save. Please try again.
        </p>
      )}
    </div>
  );
}
