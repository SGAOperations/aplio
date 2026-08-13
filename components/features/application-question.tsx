'use client';

import { useRef, useState } from 'react';

import { toast } from 'sonner';

import { OTHER_OPTION_LABEL, matchesShortAnswerFormat } from '@/lib/constants';
import type { AnswerQuestion, QuestionFileTarget } from '@/lib/types';
import { cn, partitionAnswerValue } from '@/lib/utils';

import { AnswerMismatchNotice } from '@/components/features/answer-mismatch-notice';
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
  // A returned string is a user-facing refusal; void means saved.
  onSave: (value: string[]) => Promise<string | void>;
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
  // Seeded with the RAW stored value (not `fitted`) and never re-seeded from
  // it: mount + focus + blur with no edit must serialize back to the raw
  // value and write nothing. field.value is read only here, for the notice
  // below, and for this comparison — every write is built from `fitted`.
  const savedValueRef = useRef(JSON.stringify(field.value));
  const options = Array.isArray(question.options)
    ? question.options.filter((o): o is string => typeof o === 'string')
    : [];
  const { fitted, orphaned } = partitionAnswerValue(question, field.value);
  const noticeId = `${question.id}-mismatch`;
  const labelId = `${question.id}-label`;

  // Any fitted value that isn't one of the admin-defined options is the
  // applicant's typed "Other" text (options is a closed set — see issue
  // #322). Gated on allowOther so an orphaned value can never masquerade as
  // "Other" once the option is turned off for this question.
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
      const refusal = await onSave(value);
      if (refusal) {
        // Don't advance savedValueRef, so a retry is still attempted.
        setSaveError(true);
        toast.error(refusal);
        return;
      }
      savedValueRef.current = serialized;
    } catch {
      setSaveError(true);
      toast.error('Failed to save answer');
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
    await save(field.value);
  }

  return (
    <div
      className={cn(
        'bg-card rounded-lg border p-4 shadow-sm',
        error && 'border-destructive',
      )}
    >
      <p
        id={labelId}
        className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase"
      >
        {question.label}
        {question.required && <span className="text-destructive ml-1">*</span>}
      </p>

      {orphaned.length > 0 && (
        <AnswerMismatchNotice
          id={noticeId}
          values={orphaned}
          questionType={question.type}
        />
      )}

      {question.type === 'short_answer' && (
        <Input
          value={fitted[0] ?? ''}
          onChange={(e) =>
            field.onChange(e.target.value ? [e.target.value] : [])
          }
          onBlur={handleBlur}
          placeholder="Your answer"
          aria-describedby={orphaned.length > 0 ? noticeId : undefined}
        />
      )}

      {question.type === 'long_answer' && (
        <Textarea
          value={fitted[0] ?? ''}
          onChange={(e) =>
            field.onChange(e.target.value ? [e.target.value] : [])
          }
          onBlur={handleBlur}
          placeholder="Your answer"
          className="min-h-[120px]"
          aria-describedby={orphaned.length > 0 ? noticeId : undefined}
        />
      )}

      {question.type === 'single_choice' && (
        <div
          role="group"
          aria-labelledby={labelId}
          aria-describedby={orphaned.length > 0 ? noticeId : undefined}
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
                  save([option]);
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
                    save(next);
                  }}
                  className="accent-primary size-4"
                />
                {OTHER_OPTION_LABEL}
              </Label>

              {otherSelected && (
                <div className="ml-6 flex flex-col gap-1">
                  <Label
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
                    onBlur={handleBlur}
                    placeholder="Type your answer"
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
          aria-describedby={orphaned.length > 0 ? noticeId : undefined}
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
                  save(next);
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
                      save(next);
                    } else {
                      // Drops the typed text immediately, so it isn't resubmitted.
                      setOtherText('');
                      field.onChange(checkedOptions);
                      save(checkedOptions);
                    }
                  }}
                />
                {OTHER_OPTION_LABEL}
              </Label>

              {otherSelected && (
                <div className="ml-6 flex flex-col gap-1">
                  <Label
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
                    onBlur={handleBlur}
                    placeholder="Type your answer"
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
        />
      )}

      {error && <p className="text-destructive mt-2 text-xs">{error}</p>}
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
