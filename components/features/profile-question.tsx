'use client';

import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { toast } from 'sonner';

import { updateGlobalAnswer } from '@/prisma/actions/profile';
import type { GlobalAnswer, GlobalQuestion } from '@/prisma/client';

import { OTHER_OPTION_LABEL } from '@/lib/constants';
import { isError } from '@/lib/utils';

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

  // Any answer value that isn't one of the admin-defined options is the
  // applicant's typed "Other" text (options is a closed set — see issue #322).
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

  function handleBlur() {
    save(getValues('value'));
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
                  onChange={(e) =>
                    field.onChange(e.target.value ? [e.target.value] : [])
                  }
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
                        ? OTHER_OPTION_LABEL
                        : (field.value[0] ?? '')
                    }
                    onValueChange={(v) => {
                      if (v === OTHER_OPTION_LABEL) {
                        setOtherSelected(true);
                        const next = otherText ? [otherText] : [];
                        field.onChange(next);
                        save(next);
                        return;
                      }
                      // Picking a real option hides the "Other" input and
                      // clears any previously typed text so it is never
                      // silently resubmitted.
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
                          value={OTHER_OPTION_LABEL}
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
                          // Uncheck removes the typed text from the saved
                          // array immediately so it isn't silently resubmitted.
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
