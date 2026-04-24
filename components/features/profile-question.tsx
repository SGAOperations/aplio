'use client';

import { Controller, useForm } from 'react-hook-form';

import { updateGlobalAnswer } from '@/prisma/actions/profile';
import type { GlobalAnswer, GlobalQuestion } from '@/prisma/client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ProfileQuestionProps {
  question: GlobalQuestion;
  answer: GlobalAnswer | null;
  userId: string;
  isEditing: boolean;
}

export function ProfileQuestion({
  question,
  answer,
  userId,
  isEditing,
}: ProfileQuestionProps) {
  const { control, formState, getValues, reset } = useForm<{ value: string[] }>(
    { defaultValues: { value: answer?.value ?? [] } },
  );

  const displayValue = getValues('value').join(', ') || null;

  async function save(value: string[]) {
    try {
      await updateGlobalAnswer(userId, question.id, value);
      reset({ value });
    } catch {
      // silent — autosave is best-effort
    }
  }

  async function handleBlur() {
    if (!formState.isDirty) return;
    save(getValues('value'));
  }

  return (
    <div className="bg-card rounded-lg border p-4 shadow-sm">
      <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
        {question.label}
        {question.required && <span className="text-destructive ml-1">*</span>}
      </p>

      {!isEditing && (
        <p
          className={
            displayValue
              ? 'text-foreground text-base font-medium'
              : 'text-muted-foreground text-sm italic'
          }
        >
          {displayValue ?? 'No answer yet'}
        </p>
      )}

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
                  {question.options.map((option: string) => (
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
                {question.options.map((option: string) => (
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
      )}
    </div>
  );
}
