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

type FormValues = { value: string[] };

export function ProfileQuestion({
  question,
  answer,
  userId,
  isEditing,
}: ProfileQuestionProps) {
  const { control, formState, getValues, reset } = useForm<FormValues>({
    defaultValues: { value: answer?.value ?? [] },
  });

  const displayValue =
    ((formState.defaultValues?.value as string[] | undefined) ?? []).join(
      ', ',
    ) || null;

  async function handleBlur() {
    if (!formState.isDirty) return;
    const value = getValues('value');
    try {
      await updateGlobalAnswer(userId, question.id, value);
      reset({ value });
    } catch {
      // silent — autosave is best-effort
    }
  }

  async function handleChoiceChange(newValue: string[]) {
    const saved =
      (formState.defaultValues?.value as string[] | undefined) ?? [];
    if (JSON.stringify(newValue) === JSON.stringify(saved)) return;
    try {
      await updateGlobalAnswer(userId, question.id, newValue);
      reset({ value: newValue });
    } catch {
      // silent — autosave is best-effort
    }
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

      {isEditing && question.type === 'short_answer' && (
        <Controller
          control={control}
          name="value"
          render={({ field }) => (
            <Input
              value={field.value[0] ?? ''}
              onChange={(e) =>
                field.onChange(e.target.value ? [e.target.value] : [])
              }
              onBlur={handleBlur}
              placeholder="Your answer"
            />
          )}
        />
      )}

      {isEditing && question.type === 'long_answer' && (
        <Controller
          control={control}
          name="value"
          render={({ field }) => (
            <Textarea
              value={field.value[0] ?? ''}
              onChange={(e) =>
                field.onChange(e.target.value ? [e.target.value] : [])
              }
              onBlur={handleBlur}
              placeholder="Your answer"
              className="min-h-[100px]"
            />
          )}
        />
      )}

      {isEditing && question.type === 'single_choice' && (
        <Controller
          control={control}
          name="value"
          render={({ field }) => (
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
                      const next = [option];
                      field.onChange(next);
                      handleChoiceChange(next);
                    }}
                    className="accent-primary size-4"
                  />
                  {option}
                </Label>
              ))}
            </div>
          )}
        />
      )}

      {isEditing && question.type === 'multiple_choice' && (
        <Controller
          control={control}
          name="value"
          render={({ field }) => (
            <div className="flex flex-col gap-2">
              {question.options.map((option: string) => (
                <Label
                  key={option}
                  className="flex cursor-pointer items-center gap-2 font-normal"
                >
                  <input
                    type="checkbox"
                    value={option}
                    checked={field.value.includes(option)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...field.value, option]
                        : field.value.filter((v) => v !== option);
                      field.onChange(next);
                      handleChoiceChange(next);
                    }}
                    className="accent-primary size-4"
                  />
                  {option}
                </Label>
              ))}
            </div>
          )}
        />
      )}
    </div>
  );
}
