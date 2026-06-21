'use client';

import type { ReactNode } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import { z } from 'zod/v4';

import {
  createGlobalQuestion,
  updateGlobalQuestion,
} from '@/prisma/services/global-question-actions';
import {
  QUESTION_TYPE_LABELS,
  QUESTION_TYPE_VALUES,
} from '@/prisma/services/global-question-constants';
import type { GlobalQuestionListItem } from '@/prisma/services/global-question-types';

import { Checkbox } from '@/components/ui/checkbox';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { FormDialog } from '@/components/ui/form-dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CHOICE_TYPES = ['single_choice', 'multiple_choice'] as const;
type ChoiceType = (typeof CHOICE_TYPES)[number];

const questionSchema = z
  .object({
    label: z.string().min(1, 'Label is required'),
    type: z.enum(QUESTION_TYPE_VALUES),
    required: z.boolean(),
    options: z.array(z.string()),
  })
  .superRefine((data, ctx) => {
    // Choice-type questions must have at least one option.
    if (
      CHOICE_TYPES.includes(data.type as ChoiceType) &&
      data.options.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'At least one option is required for choice questions',
      });
    }
  });

type QuestionFormValues = z.infer<typeof questionSchema>;

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
  question?: GlobalQuestionListItem;
}

export function GlobalQuestionDialog({
  trigger,
  question,
}: GlobalQuestionDialogProps) {
  const isEditing = question !== undefined;

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
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {QUESTION_TYPE_VALUES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {QUESTION_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        name="required"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center gap-3">
            <FormControl>
              <Checkbox
                checked={field.value as boolean}
                onCheckedChange={field.onChange}
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
