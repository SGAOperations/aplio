'use client';

import { useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { updateGlobalAnswer } from '@/prisma/actions/profile';
import type { GlobalAnswer, GlobalQuestion } from '@/prisma/client';

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

  async function save(value: string[]) {
    const serialized = JSON.stringify(value);
    if (serialized === savedValueRef.current) return;
    try {
      const result = await updateGlobalAnswer(question.id, value);
      if (isError(result)) throw new Error(result.error);
      savedValueRef.current = serialized;
      reset({ value });
    } catch {
      // silent — autosave is best-effort; savedValueRef is not advanced on failure so retries work
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
                <RadioGroup
                  value={field.value[0] ?? ''}
                  onValueChange={(v) => {
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
                </RadioGroup>
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
              </div>
            );
          }}
        />
      )}
    </div>
  );
}
