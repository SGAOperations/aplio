'use client';

import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { toast } from 'sonner';

import { updateGlobalAnswer } from '@/prisma/actions/profile';
import type { GlobalAnswer, GlobalQuestion } from '@/prisma/client';

import {
  OTHER_OPTION_LABEL,
  OTHER_OPTION_VALUE,
  SHORT_ANSWER_FORMAT_ERROR_MESSAGES,
  matchesShortAnswerFormat,
} from '@/lib/constants';
import { isError } from '@/lib/utils';

import { AnswerFileLink } from '@/components/features/answer-file-link';
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
  const [formatError, setFormatError] = useState<string | null>(null);

  // options is a closed set, so any value outside it is the applicant's "Other" text.
  const initialOtherValue = initialValue.find(
    (v) => !question.options.includes(v),
  );
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
      if (isError(result)) throw new Error(result.error);
      savedValueRef.current = serialized;
      reset({ value });
    } catch {
      // savedValueRef is not advanced on failure so retries work
      setSaveError(true);
      toast.error('Failed to save answer');
    } finally {
      setIsSaving(false);
    }
  }

  // This autosave fails silently, so blocking here is the only way the user sees it.
  function handleBlur() {
    const value = getValues('value');
    if (
      question.type === 'short_answer' &&
      question.format &&
      value[0] &&
      !matchesShortAnswerFormat(value[0], question.format)
    ) {
      setFormatError(SHORT_ANSWER_FORMAT_ERROR_MESSAGES[question.format]);
      return;
    }
    setFormatError(null);
    save(value);
  }

  return (
    <div className="bg-card rounded-lg border p-4 shadow-sm">
      <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
        {question.label}
        {question.required && <span className="text-destructive ml-1">*</span>}
      </p>

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
            if (question.type === 'short_answer')
              return (
                <Input
                  value={field.value[0] ?? ''}
                  onChange={(e) => {
                    field.onChange(e.target.value ? [e.target.value] : []);
                    setFormatError(null);
                  }}
                  onBlur={handleBlur}
                  placeholder="Your answer"
                />
              );

            if (question.type === 'long_answer')
              return (
                <Textarea
                  value={field.value[0] ?? ''}
                  onChange={(e) =>
                    field.onChange(e.target.value ? [e.target.value] : [])
                  }
                  onBlur={handleBlur}
                  placeholder="Your answer"
                  className="min-h-[100px]"
                />
              );

            if (question.type === 'single_choice')
              return (
                <div className="flex flex-col gap-2">
                  <RadioGroup
                    value={
                      otherSelected
                        ? OTHER_OPTION_VALUE
                        : (field.value[0] ?? '')
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
                        placeholder="Type your answer"
                      />
                    </div>
                  )}
                </div>
              );

            if (question.type === 'file_upload')
              return (
                <QuestionFileField
                  target={{ scope: 'profile', questionId: question.id }}
                  value={field.value}
                  onChange={(v) => {
                    // Already persisted by the file actions: syncs local state only.
                    field.onChange(v);
                    savedValueRef.current = JSON.stringify(v);
                    reset({ value: v });
                  }}
                />
              );

            // question.type === 'multiple_choice'
            return (
              <div className="flex flex-col gap-2">
                {question.options.map((option: string, i: number) => (
                  <div
                    key={option}
                    className="flex cursor-pointer items-center gap-2 py-1"
                  >
                    <Checkbox
                      id={`${question.id}-${i}`}
                      checked={field.value.includes(option)}
                      onCheckedChange={() => {
                        const next = field.value.includes(option)
                          ? field.value.filter((v) => v !== option)
                          : [...field.value, option];
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
                        const checkedOptions = field.value.filter((v) =>
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
                        const checkedOptions = field.value.filter((v) =>
                          question.options.includes(v),
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
              </div>
            );
          }}
        />
      )}

      {isEditing && formatError && (
        <p className="text-destructive mt-2 text-xs">{formatError}</p>
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
