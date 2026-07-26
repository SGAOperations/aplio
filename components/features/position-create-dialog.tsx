'use client';

import { useRouter } from 'next/navigation';
import { useFormContext } from 'react-hook-form';

import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { z } from 'zod/v4';

import { createPosition } from '@/prisma/actions/position-actions';

import { STATUS_OPTIONS, positionFormSchema } from '@/lib/constants';

import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';

type PositionFormValues = z.infer<typeof positionFormSchema>;

const defaultValues: PositionFormValues = {
  title: '',
  description: '',
  status: 'draft',
  opensAt: '',
  closesAt: '',
};

// Rendered as a child of FormDialog (which wraps children in FormProvider),
// so this can read isSubmitting via context to disable every field while the
// create request is in flight — matches PositionDetailsForm's pattern.
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

      <FormField
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Position description"
                rows={4}
                disabled={isSubmitting}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

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
              <Input type="datetime-local" disabled={isSubmitting} {...field} />
            </FormControl>
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
              <Input type="datetime-local" disabled={isSubmitting} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

// Dialog-triggered, so this adopts FormDialog + positionFormSchema directly,
// matching GlobalQuestionDialog's pattern (ENGINEERING §1: reconcile ad-hoc
// forms onto the established RHF + zod convention).
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
          <Plus className="size-4" />
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
