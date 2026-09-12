'use client';

import { useRef } from 'react';
import { useForm } from 'react-hook-form';

import { updatePositionSchedule } from '@/prisma/actions/position-actions';

import {
  POSITION_CLOSES_AT_ORDER_ERROR,
  POSITION_OPENS_AT_ORDER_ERROR,
  positionPastDateIssues,
} from '@/lib/constants';
import { toOrgDayString } from '@/lib/dates';
import { autosaveStatusText, useAutosave } from '@/lib/use-autosave';
import { ActionError, isError } from '@/lib/utils';

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

interface ScheduleValues {
  opensAt: string;
  closesAt: string;
}

interface PositionAvailabilitySectionProps {
  positionId: string;
  opensAt: string | null;
  closesAt: string | null;
}

// No zodResolver — the pair saves together, so validation runs inside the commit handler instead.
export function PositionAvailabilitySection({
  positionId,
  opensAt,
  closesAt,
}: PositionAvailabilitySectionProps) {
  const initial: ScheduleValues = {
    opensAt: opensAt ?? '',
    closesAt: closesAt ?? '',
  };
  const form = useForm<ScheduleValues>({ defaultValues: initial });
  // The last-saved pair — positionPastDateIssues only flags a date actually
  // changed since this, so an untouched past date stays saveable.
  const lastSavedRef = useRef<ScheduleValues>(initial);

  const scheduleAutosave = useAutosave({
    initialValue: initial,
    save: async (value: ScheduleValues) => {
      const result = await updatePositionSchedule({
        id: positionId,
        opensAt: value.opensAt || undefined,
        closesAt: value.closesAt || undefined,
      });
      if (isError(result)) throw new ActionError(result.error);
      lastSavedRef.current = value;
    },
  });

  function validate(values: ScheduleValues): boolean {
    form.clearErrors();
    let valid = true;

    if (values.opensAt && values.closesAt && values.opensAt > values.closesAt) {
      form.setError('opensAt', { message: POSITION_OPENS_AT_ORDER_ERROR });
      form.setError('closesAt', { message: POSITION_CLOSES_AT_ORDER_ERROR });
      valid = false;
    }

    for (const issue of positionPastDateIssues(
      values,
      toOrgDayString(new Date()),
      lastSavedRef.current,
    )) {
      form.setError(issue.path, { message: issue.message });
      valid = false;
    }

    return valid;
  }

  function handleFieldBlur() {
    const values = form.getValues();
    if (validate(values)) scheduleAutosave.commit(values);
  }

  const statusText = autosaveStatusText(
    scheduleAutosave.status,
    scheduleAutosave.error,
  );

  return (
    <Form {...form}>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="opensAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Opens At</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    disabled={scheduleAutosave.status === 'saving'}
                    {...field}
                    onBlur={() => {
                      field.onBlur();
                      handleFieldBlur();
                    }}
                  />
                </FormControl>
                <FormDescription>
                  Applications open at 12:00 AM Eastern on this day.
                </FormDescription>
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
                    type="date"
                    disabled={scheduleAutosave.status === 'saving'}
                    {...field}
                    onBlur={() => {
                      field.onBlur();
                      handleFieldBlur();
                    }}
                  />
                </FormControl>
                <FormDescription>
                  Applications close at 11:59 PM Eastern on this day.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {statusText && (
          <p
            aria-live="polite"
            className={
              scheduleAutosave.status === 'error'
                ? 'text-destructive text-xs'
                : 'text-muted-foreground text-xs'
            }
          >
            {statusText}
          </p>
        )}
      </div>
    </Form>
  );
}
