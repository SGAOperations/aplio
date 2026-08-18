'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { z } from 'zod/v4';

import { setUserName } from '@/prisma/actions/profile';

import { nameSchema } from '@/lib/constants';

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

type NameFormValues = z.infer<typeof nameSchema>;

interface NameFieldProps {
  defaultName: string;
  redirectTo: string;
}

export function NameField({ defaultName, redirectTo }: NameFieldProps) {
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

      toast.success('Name saved');
      router.replace(redirectTo);
    });
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">What&apos;s your name?</h1>
        <p className="text-muted-foreground text-sm">
          Enter your full name so we know who you are.
        </p>
      </div>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex w-full flex-col gap-4"
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
                    autoFocus
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending && (
              <Loader2 className="animate-spin" aria-hidden="true" />
            )}
            Continue
          </Button>
        </form>
      </Form>
    </div>
  );
}
