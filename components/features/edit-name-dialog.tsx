'use client';

import type { ReactNode } from 'react';

import { TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import type { z } from 'zod/v4';

import { setUserName } from '@/prisma/actions/profile';

import { nameSchema } from '@/lib/constants';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { FormDialog } from '@/components/ui/form-dialog';
import { Input } from '@/components/ui/input';
import { WarningCallout } from '@/components/ui/warning-callout';

type NameFormValues = z.infer<typeof nameSchema>;

interface EditNameDialogProps {
  currentName: string | null;
  trigger: ReactNode;
}

export function EditNameDialog({ currentName, trigger }: EditNameDialogProps) {
  async function onSubmit(data: NameFormValues): Promise<boolean> {
    const result = await setUserName(data);
    if (result?.error) {
      toast.error(result.error);
      return false;
    }
    toast.success('Name updated.');
    return true;
  }

  return (
    <FormDialog
      trigger={trigger}
      title="Edit name"
      description="This is the name reviewers see on your applications."
      schema={nameSchema}
      defaultValues={{ name: currentName ?? '' }}
      onSubmit={onSubmit}
      submitLabel="Save name"
    >
      <FormField
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Full name</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder="Jane Smith"
                autoComplete="name"
                autoFocus
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <WarningCallout icon={TriangleAlert}>
        Changing your name updates it everywhere — including applications
        you&apos;ve already submitted, and ones that have already been reviewed
        or decided.
      </WarningCallout>
    </FormDialog>
  );
}
