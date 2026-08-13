'use client';

import { useFormContext, useWatch } from 'react-hook-form';

import type { z } from 'zod/v4';

import {
  SHORT_ANSWER_FORMAT_OPTIONS,
  questionFormSchema,
} from '@/lib/constants';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type QuestionFormValues = z.infer<typeof questionFormSchema>;

// Radix Select rejects an empty-string item, so 'none' maps back to null on change.
const NONE_VALUE = 'none';

// Shown only for short_answer.
export function FormatField() {
  const { control, setValue } = useFormContext<QuestionFormValues>();
  const type = useWatch({ control, name: 'type' });

  if (type !== 'short_answer') return null;

  return (
    <FormField
      control={control}
      name="format"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Format</FormLabel>
          <Select
            onValueChange={(v) =>
              setValue(
                'format',
                v === NONE_VALUE ? null : (v as QuestionFormValues['format']),
                { shouldValidate: true, shouldDirty: true },
              )
            }
            value={field.value ?? NONE_VALUE}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Select a format" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>None</SelectItem>
              {SHORT_ANSWER_FORMAT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
