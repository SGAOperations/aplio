'use client';

import * as React from 'react';
import {
  DefaultValues,
  FieldValues,
  FormProvider,
  useForm,
} from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod/v4';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface FormDialogProps<
  TOutput extends FieldValues,
  TInput extends FieldValues = TOutput,
> {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  schema: z.ZodType<TOutput, TInput>;
  defaultValues: DefaultValues<TInput>;
  onSubmit: (data: TOutput) => Promise<boolean>;
  submitLabel?: string;
  children: React.ReactNode;
}

function FormDialog<
  TOutput extends FieldValues,
  TInput extends FieldValues = TOutput,
>({
  trigger,
  title,
  description,
  schema,
  defaultValues,
  onSubmit,
  submitLabel = 'Submit',
  children,
}: FormDialogProps<TOutput, TInput>) {
  const [open, setOpen] = React.useState(false);

  const form = useForm({ resolver: zodResolver(schema), defaultValues });
  const isSubmitting = form.formState.isSubmitting;

  async function handleSubmit(data: TOutput) {
    try {
      const success = await onSubmit(data);
      if (success) {
        form.reset(defaultValues);
        setOpen(false);
      }
    } catch (error) {
      // Message never surfaces (it may be a denial), but logged to stay diagnosable.
      console.error(error);
      toast.error('Something went wrong. Please try again.');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) form.reset(defaultValues);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <FormProvider {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-col gap-4"
          >
            {children}
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="animate-spin" />}
                {submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}

export { FormDialog };
export type { FormDialogProps };
