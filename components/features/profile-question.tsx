'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { updateGlobalAnswer } from '@/prisma/actions/profile';
import type { GlobalAnswer, GlobalQuestion } from '@/prisma/client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ProfileQuestionProps {
  question: GlobalQuestion;
  answer: GlobalAnswer | null;
  userId: string;
}

export function ProfileQuestion({
  question,
  answer,
  userId,
}: ProfileQuestionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [savedValue, setSavedValue] = useState<string[]>(answer?.value ?? []);

  const schema = z.object({
    value: question.required
      ? z.array(z.string()).min(1, 'This field is required')
      : z.array(z.string()),
  });
  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { value: answer?.value ?? [] },
  });

  function displayValue() {
    if (savedValue.length === 0) return null;
    if (question.type === 'multiple_choice') return savedValue.join(', ');
    return savedValue[0];
  }

  function handleEdit() {
    form.reset({ value: savedValue });
    setIsEditing(true);
  }

  function handleCancel() {
    form.reset({ value: savedValue });
    setIsEditing(false);
  }

  async function handleSave(data: FormValues) {
    await updateGlobalAnswer(userId, question.id, data.value);
    setSavedValue(data.value);
    setIsEditing(false);
  }

  const display = displayValue();
  const isPending = form.formState.isSubmitting;

  return (
    <div className="bg-card rounded-lg border p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="text-sm leading-snug font-medium">
          {question.label}
          {question.required && (
            <span className="text-destructive ml-1">*</span>
          )}
        </span>
        {!isEditing && (
          <Button variant="outline" size="sm" onClick={handleEdit}>
            Edit
          </Button>
        )}
      </div>

      {!isEditing && (
        <p className="text-muted-foreground text-sm">
          {display ?? <span className="italic">No answer yet</span>}
        </p>
      )}

      {isEditing && (
        <form
          onSubmit={form.handleSubmit(handleSave)}
          className="flex flex-col gap-3"
        >
          {question.type === 'short_answer' && (
            <Controller
              control={form.control}
              name="value"
              render={({ field }) => (
                <Input
                  value={field.value[0] ?? ''}
                  onChange={(e) =>
                    field.onChange(e.target.value ? [e.target.value] : [])
                  }
                  placeholder="Your answer"
                />
              )}
            />
          )}

          {question.type === 'long_answer' && (
            <Controller
              control={form.control}
              name="value"
              render={({ field }) => (
                <Textarea
                  value={field.value[0] ?? ''}
                  onChange={(e) =>
                    field.onChange(e.target.value ? [e.target.value] : [])
                  }
                  placeholder="Your answer"
                  className="min-h-[100px]"
                />
              )}
            />
          )}

          {question.type === 'single_choice' && (
            <Controller
              control={form.control}
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
                        onChange={() => field.onChange([option])}
                        className="accent-primary size-4"
                      />
                      {option}
                    </Label>
                  ))}
                </div>
              )}
            />
          )}

          {question.type === 'multiple_choice' && (
            <Controller
              control={form.control}
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
                          if (e.target.checked)
                            field.onChange([...field.value, option]);
                          else
                            field.onChange(
                              field.value.filter((v) => v !== option),
                            );
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

          {form.formState.errors.value?.message && (
            <p className="text-destructive text-sm">
              {form.formState.errors.value.message}
            </p>
          )}

          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
