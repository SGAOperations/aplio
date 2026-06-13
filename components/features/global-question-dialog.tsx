'use client';

import type { ReactNode } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import { z } from 'zod/v4';

import {
  createGlobalQuestion,
  updateGlobalQuestion,
} from '@/prisma/actions/global-question-actions';
import type { GlobalQuestion } from '@/prisma/client';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { FormDialog } from '@/components/ui/form-dialog';
import { Input } from '@/components/ui/input';

const questionTypeValues = [
  'short_answer',
  'long_answer',
  'single_choice',
  'multiple_choice',
] as const;

const questionSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  type: z.enum(questionTypeValues),
  required: z.boolean(),
  options: z.array(z.string()),
});

type QuestionFormValues = z.infer<typeof questionSchema>;

const TYPE_LABELS: Record<(typeof questionTypeValues)[number], string> = {
  short_answer: 'Short Answer',
  long_answer: 'Long Answer',
  single_choice: 'Single Choice',
  multiple_choice: 'Multiple Choice',
};

const CHOICE_TYPES = ['single_choice', 'multiple_choice'] as const;
type ChoiceType = (typeof CHOICE_TYPES)[number];

function OptionsField() {
  const { control, setValue, getValues } = useFormContext<QuestionFormValues>();
  const type = useWatch({ control, name: 'type' });
  const options = useWatch({ control, name: 'options' });

  if (!CHOICE_TYPES.includes(type as ChoiceType)) return null;

  function addOption(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    const current = getValues('options');
    if (!current.includes(trimmed)) setValue('options', [...current, trimmed]);
  }

  function removeOption(option: string) {
    setValue(
      'options',
      getValues('options').filter((o) => o !== option),
    );
  }

  return (
    <FormField
      control={control}
      name="options"
      render={() => (
        <FormItem>
          <FormLabel>Options</FormLabel>
          <FormControl>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-1">
                {options.map((option) => (
                  <span
                    key={option}
                    className="bg-secondary text-secondary-foreground flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                  >
                    {option}
                    <button
                      type="button"
                      onClick={() => removeOption(option)}
                      className="hover:text-destructive ml-0.5"
                      aria-label={`Remove ${option}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <Input
                placeholder="Type an option and press Enter"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addOption(e.currentTarget.value);
                    e.currentTarget.value = '';
                  }
                }}
              />
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

interface GlobalQuestionDialogProps {
  trigger: ReactNode;
  question?: GlobalQuestion;
}

export function GlobalQuestionDialog({
  trigger,
  question,
}: GlobalQuestionDialogProps) {
  const isEditing = !!question;

  const defaultValues: QuestionFormValues = {
    label: question?.label ?? '',
    type: question?.type ?? 'short_answer',
    required: question?.required ?? true,
    options: question?.options ?? [],
  };

  async function onSubmit(data: QuestionFormValues): Promise<boolean> {
    const result = isEditing
      ? await updateGlobalQuestion({ ...data, id: question.id })
      : await createGlobalQuestion(data);
    return result.ok;
  }

  return (
    <FormDialog
      trigger={trigger}
      title={isEditing ? 'Edit Question' : 'New Question'}
      schema={questionSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      submitLabel={isEditing ? 'Save Changes' : 'Create Question'}
    >
      <FormField
        name="label"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Label</FormLabel>
            <FormControl>
              <Input placeholder="e.g. What is your GPA?" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        name="type"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Type</FormLabel>
            <FormControl>
              <select
                {...field}
                className="border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
              >
                {questionTypeValues.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        name="required"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center gap-3">
            <FormControl>
              <input
                type="checkbox"
                id={field.name}
                checked={field.value as boolean}
                onChange={field.onChange}
                className="size-4"
              />
            </FormControl>
            <FormLabel className="!mt-0">Required</FormLabel>
            <FormMessage />
          </FormItem>
        )}
      />

      <OptionsField />
    </FormDialog>
  );
}
