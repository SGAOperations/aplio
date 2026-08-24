'use client';

import { useRouter } from 'next/navigation';
import { useFormContext } from 'react-hook-form';

import { toast } from 'sonner';
import type { z } from 'zod/v4';

import { createPosition } from '@/prisma/actions/position-actions';

import { STATUS_OPTIONS, positionFormSchema } from '@/lib/constants';
import { ACTION_ICONS } from '@/lib/icons';

import { MarkdownField } from '@/components/features/markdown-field';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormDescription,
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

type PositionFormValues = z.infer<typeof positionFormSchema>;

const defaultValues: PositionFormValues = {
  title: '',
  description: '',
  status: 'draft',
  opensAt: '',
  closesAt: '',
};

// FormDialog wraps children in FormProvider, so isSubmitting comes from context.
function PositionFormFields() {
  const { formState } = useFormContext<PositionFormValues>();
  const isSubmitting = formState.isSubmitting;

  return (
    <>
      <FormField
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Title</FormLabel>
            <FormControl>
              <Input
                placeholder="Position title"
                disabled={isSubmitting}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <MarkdownField />

      <FormField
        name="status"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Status</FormLabel>
            <Select
              onValueChange={field.onChange}
              value={field.value}
              disabled={isSubmitting}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
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

      <FormField
        name="opensAt"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Opens at (optional)</FormLabel>
            <FormControl>
              <Input type="date" disabled={isSubmitting} {...field} />
            </FormControl>
            <FormDescription>
              Applications open at 12:00 AM Eastern on this day.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        name="closesAt"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Closes at (optional)</FormLabel>
            <FormControl>
              <Input type="date" disabled={isSubmitting} {...field} />
            </FormControl>
            <FormDescription>
              Applications close at 11:59 PM Eastern on this day.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

// Dialog-triggered, so it uses FormDialog directly, as GlobalQuestionDialog does.
export function PositionCreateDialog() {
  const router = useRouter();

  async function onSubmit(data: PositionFormValues): Promise<boolean> {
    const result = await createPosition({
      ...data,
      opensAt: data.opensAt || undefined,
      closesAt: data.closesAt || undefined,
    });
    if ('error' in result) {
      toast.error(result.error);
      return false;
    }
    toast.success('Position created');
    router.push(`/positions/${result.id}/edit`);
    return true;
  }

  return (
    <FormDialog
      trigger={
        <Button>
          <ACTION_ICONS.create />
          New Position
        </Button>
      }
      title="Create Position"
      schema={positionFormSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      submitLabel="Create Position"
    >
      <PositionFormFields />
    </FormDialog>
  );
}
