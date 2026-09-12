'use client';

import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';

import {
  updatePositionDescription,
  updatePositionTitle,
} from '@/prisma/actions/position-actions';

import {
  positionDescriptionSchema,
  positionTitleSchema,
} from '@/lib/constants';
import { autosaveStatusText, useAutosave } from '@/lib/use-autosave';
import { ActionError, isError } from '@/lib/utils';

import { MarkdownField } from '@/components/features/markdown-field';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const detailsSchema = z.object({
  title: positionTitleSchema,
  description: positionDescriptionSchema,
});
type DetailsValues = z.infer<typeof detailsSchema>;

interface PositionDetailsSectionProps {
  positionId: string;
  title: string;
  description: string;
  // Rendered between the title and description fields — e.g. the
  // availability (opens/closes) fields, kept as their own component.
  children?: ReactNode;
}

export function PositionDetailsSection({
  positionId,
  title,
  description,
  children,
}: PositionDetailsSectionProps) {
  const form = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { title, description },
    mode: 'onBlur',
  });

  const titleAutosave = useAutosave({
    initialValue: title,
    save: async (value: string) => {
      const result = await updatePositionTitle({
        id: positionId,
        title: value,
      });
      if (isError(result)) throw new ActionError(result.error);
    },
  });

  const descriptionAutosave = useAutosave({
    initialValue: description,
    save: async (value: string) => {
      const result = await updatePositionDescription({
        id: positionId,
        description: value,
      });
      if (isError(result)) throw new ActionError(result.error);
    },
  });

  return (
    <Form {...form}>
      <div className="flex flex-col gap-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => {
            const statusText = autosaveStatusText(
              titleAutosave.status,
              titleAutosave.error,
            );
            return (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    disabled={titleAutosave.status === 'saving'}
                    onBlur={(e) => {
                      field.onBlur();
                      const value = e.target.value;
                      void (async () => {
                        const valid = await form.trigger('title');
                        if (valid) titleAutosave.commit(value);
                      })();
                    }}
                  />
                </FormControl>
                <FormMessage />
                {statusText && (
                  <FormDescription
                    aria-live="polite"
                    className={
                      titleAutosave.status === 'error'
                        ? 'text-destructive text-xs'
                        : 'text-xs'
                    }
                  >
                    {statusText}
                  </FormDescription>
                )}
              </FormItem>
            );
          }}
        />

        {children}

        <MarkdownField
          disabled={descriptionAutosave.status === 'saving'}
          onCommit={(value) => {
            void (async () => {
              const valid = await form.trigger('description');
              if (valid) descriptionAutosave.commit(value);
            })();
          }}
          footer={(() => {
            const statusText = autosaveStatusText(
              descriptionAutosave.status,
              descriptionAutosave.error,
            );
            return statusText ? (
              <p
                aria-live="polite"
                className={
                  descriptionAutosave.status === 'error'
                    ? 'text-destructive text-xs'
                    : 'text-muted-foreground text-xs'
                }
              >
                {statusText}
              </p>
            ) : undefined;
          })()}
        />
      </div>
    </Form>
  );
}
