'use client';

import { useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { z } from 'zod/v4';

import { updatePosition } from '@/prisma/actions/position-actions';
import type { PositionStatus } from '@/prisma/client';

import { STATUS_OPTIONS, positionFormSchema } from '@/lib/constants';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface PositionDetailsFormProps {
  position: {
    id: string;
    title: string;
    description: string;
    status: PositionStatus;
    opensAt: string | null;
    closesAt: string | null;
  };
}

type PositionFormValues = z.infer<typeof positionFormSchema>;

function formatDateForInput(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 16);
}

// Always visible, not dialog-triggered: shadcn Form primitives directly, no FormDialog.
export function PositionDetailsForm({ position }: PositionDetailsFormProps) {
  const form = useForm<PositionFormValues>({
    resolver: zodResolver(positionFormSchema),
    defaultValues: {
      title: position.title,
      description: position.description,
      status: position.status,
      opensAt: formatDateForInput(position.opensAt),
      closesAt: formatDateForInput(position.closesAt),
    },
  });
  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(data: PositionFormValues) {
    try {
      const result = await updatePosition({
        id: position.id,
        ...data,
        opensAt: data.opensAt || undefined,
        closesAt: data.closesAt || undefined,
      });

      if (result && 'error' in result) {
        toast.error(result.error);
      } else {
        toast.success('Position updated');
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
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input disabled={isSubmitting} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea rows={4} disabled={isSubmitting} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
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

        <div className="grid gap-2 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="opensAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Opens At</FormLabel>
                <FormControl>
                  <Input
                    type="datetime-local"
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
            name="closesAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Closes At</FormLabel>
                <FormControl>
                  <Input
                    type="datetime-local"
                    disabled={isSubmitting}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>
    </Form>
  );
}
