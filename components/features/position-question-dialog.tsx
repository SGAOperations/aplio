'use client';

import { useForm, useWatch } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { z } from 'zod/v4';

import {
  createPositionQuestion,
  updatePositionQuestion,
} from '@/prisma/actions/position-question-actions';
import type { QuestionType } from '@/prisma/client';

import {
  CHOICE_TYPES,
  type ChoiceType,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPE_VALUES,
  type ShortAnswerFormatValue,
  questionFormSchema,
} from '@/lib/constants';

import { FormatField } from '@/components/features/question-format-field';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { OptionsChipEditor } from '@/components/ui/options-chip-editor';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

// Only the fields rendered in PositionQuestionsSection and needed for optimistic updates.
export interface RenderedQuestion {
  id: string;
  positionId: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options: string[];
  allowOther: boolean;
  format: ShortAnswerFormatValue | null;
  order: number;
}

export interface QuestionFormProps {
  positionId: string;
  question?: RenderedQuestion;
  onSuccess: (question: RenderedQuestion) => void;
  onClose: () => void;
}

type QuestionFormValues = z.infer<typeof questionFormSchema>;

// Rendered inline in a Card, not behind a trigger: shadcn Form primitives, no FormDialog.
export function QuestionForm({
  positionId,
  question,
  onSuccess,
  onClose,
}: QuestionFormProps) {
  const form = useForm<QuestionFormValues>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: {
      label: question?.label ?? '',
      type: question?.type ?? 'short_answer',
      required: question?.required ?? true,
      options: question?.options ?? [],
      allowOther: question?.allowOther ?? false,
      format: question?.format ?? null,
    },
  });
  const isSubmitting = form.formState.isSubmitting;

  const type = useWatch({ control: form.control, name: 'type' });
  const options = useWatch({ control: form.control, name: 'options' });
  const isChoiceType = CHOICE_TYPES.includes(type as ChoiceType);

  async function onSubmit(data: QuestionFormValues) {
    try {
      if (question) {
        const result = await updatePositionQuestion({
          id: question.id,
          positionId,
          ...data,
        });
        if (result && 'error' in result) {
          toast.error(result.error);
          return;
        }
        toast.success('Question updated');
        onClose();
        onSuccess({
          id: question.id,
          positionId,
          order: question.order,
          ...data,
        });
      } else {
        const result = await createPositionQuestion({ positionId, ...data });
        if (result && 'error' in result) {
          toast.error(result.error);
          return;
        }
        toast.success('Question added');
        onClose();
        onSuccess({ id: result.id, positionId, order: result.order, ...data });
      }
    } catch (error) {
      console.error(error);
      toast.error('Something went wrong. Please try again.');
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <FormField
          control={form.control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Question</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter question text"
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select
                onValueChange={(v) => {
                  field.onChange(v);
                  // Clear stale options/allowOther so a non-choice type can't persist them.
                  if (!CHOICE_TYPES.includes(v as ChoiceType)) {
                    form.setValue('options', []);
                    form.setValue('allowOther', false);
                  }
                  // format is meaningful only for short_answer.
                  if (v !== 'short_answer') form.setValue('format', null);
                }}
                value={field.value}
                disabled={isSubmitting}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
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

        <FormatField />

        <FormField
          control={form.control}
          name="required"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-2">
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormLabel>Required</FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />

        {isChoiceType && (
          <FormField
            control={form.control}
            name="allowOther"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-2">
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isSubmitting}
                  />
                </FormControl>
                <FormLabel>Allow &quot;Other&quot;</FormLabel>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {isChoiceType && (
          <FormField
            control={form.control}
            name="options"
            render={() => (
              <FormItem>
                <FormLabel>Options</FormLabel>
                <FormControl>
                  <OptionsChipEditor
                    options={options}
                    onChange={(next) => form.setValue('options', next)}
                    disabled={isSubmitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            {question ? 'Save Changes' : 'Add Question'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={isSubmitting}
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
