'use client';

import { useTransition } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { createOrUpdateApplicationAnswer } from '@/prisma/actions/applications';
import type {
  GlobalAnswer,
  GlobalApplicationAnswer,
  GlobalQuestion,
  PositionApplicationAnswer,
  PositionQuestion,
} from '@/prisma/client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ApplicationQuestionProps {
  applicationId: string;
  question: GlobalQuestion | PositionQuestion;
  answer: GlobalApplicationAnswer | PositionApplicationAnswer | null;
  profileAnswer: GlobalAnswer | null;
  readOnly: boolean;
  isGlobal: boolean;
  userId: string;
}

export function ApplicationQuestion({
  applicationId,
  question,
  answer,
  profileAnswer,
  readOnly,
  isGlobal,
  userId,
}: ApplicationQuestionProps) {
  const [isPending, startTransition] = useTransition();
  const { control, formState, getValues, reset } = useForm<{ value: string[] }>(
    { defaultValues: { value: answer?.value ?? profileAnswer?.value ?? [] } },
  );

  const options = question.options as string[];

  function save(value: string[]) {
    startTransition(async () => {
      await createOrUpdateApplicationAnswer({
        applicationId,
        questionId: question.id,
        questionLabel: question.label,
        value,
        isGlobal,
        userId,
      });
      reset({ value });
    });
  }

  function handleBlur() {
    if (!formState.isDirty) return;
    save(getValues('value'));
  }

  if (readOnly) {
    const displayValue = profileAnswer?.value ?? [];
    return (
      <div className="bg-card rounded-lg border p-4 shadow-sm">
        <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
          {question.label}
          {question.required && (
            <span className="text-destructive ml-1">*</span>
          )}
        </p>
        {displayValue.length === 0 ? (
          <p className="text-muted-foreground text-sm italic">No answer yet</p>
        ) : question.type === 'multiple_choice' ? (
          <div className="flex flex-wrap gap-1.5">
            {displayValue.map((v: string) => (
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

  return (
    <div className="bg-card rounded-lg border p-4 shadow-sm">
      <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
        {question.label}
        {question.required && <span className="text-destructive ml-1">*</span>}
      </p>

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
                className="min-h-[120px]"
              />
            );

          if (question.type === 'single_choice')
            return (
              <div className="flex flex-col gap-2">
                {options.map((option) => (
                  <Label
                    key={option}
                    className="flex cursor-pointer items-center gap-2 font-normal"
                  >
                    <input
                      type="radio"
                      name={question.id}
                      value={option}
                      checked={field.value[0] === option}
                      onChange={() => {
                        field.onChange([option]);
                        save([option]);
                      }}
                      className="accent-primary size-4"
                    />
                    {option}
                  </Label>
                ))}
              </div>
            );

          return (
            <div className="flex flex-col gap-2">
              {options.map((option) => (
                <Label
                  key={option}
                  className="flex cursor-pointer items-center gap-2 font-normal"
                >
                  <input
                    type="checkbox"
                    checked={field.value.includes(option)}
                    onChange={() => {
                      const next = field.value.includes(option)
                        ? field.value.filter((v) => v !== option)
                        : [...field.value, option];
                      field.onChange(next);
                      save(next);
                    }}
                    className="accent-primary size-4"
                  />
                  {option}
                </Label>
              ))}
            </div>
          );
        }}
      />

      {isPending && (
        <span className="text-muted-foreground mt-2 block text-xs">
          Saving...
        </span>
      )}
    </div>
  );
}
