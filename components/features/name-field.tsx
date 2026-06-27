'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod/v4';

import { setUserName } from '@/prisma/actions/profile';

import { authClient } from '@/lib/auth/client';
import { NAME_MAX_LENGTH } from '@/lib/constants';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const nameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter your full name.')
    .max(
      NAME_MAX_LENGTH,
      `Name must be ${NAME_MAX_LENGTH} characters or fewer.`,
    ),
});

type NameFormValues = z.infer<typeof nameSchema>;

interface NameFieldProps {
  defaultName: string;
}

export function NameField({ defaultName }: NameFieldProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<NameFormValues>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: defaultName },
  });

  function onSubmit(values: NameFormValues) {
    startTransition(async () => {
      const result = await setUserName({ name: values.name });
      if (result && 'error' in result) {
        toast.error(result.error);
        return;
      }

      // Sync the Neon Auth account — client-only singleton, runs after the
      // server action (which is the gate-clearing source of truth).
      const authResult = await authClient.updateUser({ name: values.name });
      if (authResult.error)
        toast.warning(
          'Name saved, but account sync failed. Reload if issues persist.',
        );
      else toast.success('Name saved');

      router.replace('/');
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>What&apos;s your name?</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4 text-sm">
          Enter your full name so reviewers know who you are.
        </p>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Jane Smith"
                      disabled={isPending}
                      autoComplete="name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isPending} className="self-start">
              {isPending && (
                <Loader2 className="animate-spin" aria-hidden="true" />
              )}
              Continue
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
