'use client';

import type { ReactNode } from 'react';

import { toast } from 'sonner';

import { createUser } from '@/prisma/actions/users';

import { createUserSchema } from '@/lib/constants';

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

type CreateUserFormValues = { email: string; name?: string; isAdmin: boolean };

const defaultValues: CreateUserFormValues = {
  email: '',
  name: '',
  isAdmin: false,
};

interface CreateUserDialogProps {
  trigger: ReactNode;
}

export function CreateUserDialog({ trigger }: CreateUserDialogProps) {
  async function onSubmit(data: CreateUserFormValues): Promise<boolean> {
    try {
      const result = await createUser(data);
      if (result?.error) {
        toast.error(result.error);
        return false;
      }
      toast.success(data.isAdmin ? 'Admin user created.' : 'User created.');
      return true;
    } catch {
      toast.error('Something went wrong. Please try again.');
      return false;
    }
  }

  return (
    <FormDialog
      trigger={trigger}
      title="Create User"
      schema={createUserSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      submitLabel="Create user"
    >
      <FormField
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input type="email" placeholder="user@example.com" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input placeholder="Optional" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        name="isAdmin"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center gap-3">
            <FormControl>
              <Checkbox
                checked={field.value as boolean}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <FormLabel>Admin</FormLabel>
            <FormMessage />
          </FormItem>
        )}
      />
    </FormDialog>
  );
}
