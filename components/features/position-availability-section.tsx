'use client';

import { useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { updatePositionSchedule } from '@/prisma/actions/position-actions';
import type { PositionStatus } from '@/prisma/client';

import {
  ORG_TIMEZONE,
  POSITION_DATE_CLEAR_BLOCKED_ERROR,
  positionScheduleClearIssues,
  positionScheduleIssues,
} from '@/lib/constants';
import { orgDayStart, toOrgDayString } from '@/lib/dates';
import { ACTION_ICONS } from '@/lib/icons';
import { autosaveStatusText, useAutosave } from '@/lib/use-autosave';
import { ActionError, isDraftFutureOpenDate, isError } from '@/lib/utils';

import { Button } from '@/components/ui/button';
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
import { LocalTime } from '@/components/ui/local-time';
import { WarningCallout } from '@/components/ui/warning-callout';

interface ScheduleValues {
  opensAt: string;
  closesAt: string;
}

interface ScheduleFieldConfig {
  name: keyof ScheduleValues;
  label: string;
  clearLabel: string;
  setDescription: string;
  draftSetDescription?: string;
  emptyDescription: string;
}

const SCHEDULE_FIELDS: ScheduleFieldConfig[] = [
  {
    name: 'opensAt',
    label: 'Opens At',
    clearLabel: 'Clear open date',
    setDescription: 'Applications open at 12:00 AM Eastern on this day.',
    draftSetDescription:
      'Once this position is open, applications open at 12:00 AM Eastern on this day.',
    emptyDescription:
      'No open date — applications open as soon as this position is open.',
  },
  {
    name: 'closesAt',
    label: 'Closes At',
    clearLabel: 'Clear close date',
    setDescription: 'Applications close at 11:59 PM Eastern on this day.',
    emptyDescription:
      'No close date — applications stay open until you close this position.',
  },
];

interface PositionAvailabilitySectionProps {
  positionId: string;
  opensAt: string | null;
  closesAt: string | null;
  status: PositionStatus;
  today: string;
}

// No zodResolver — the pair saves together, so validation runs inside the commit handler instead.
export function PositionAvailabilitySection({
  positionId,
  opensAt,
  closesAt,
  status,
  today,
}: PositionAvailabilitySectionProps) {
  const initial: ScheduleValues = {
    opensAt: opensAt ?? '',
    closesAt: closesAt ?? '',
  };
  const form = useForm<ScheduleValues>({ defaultValues: initial });
  const watchedOpensAt = useWatch({ control: form.control, name: 'opensAt' });
  const showDraftOpenWarning = isDraftFutureOpenDate(
    status,
    watchedOpensAt,
    today,
  );
  // The last-saved pair — positionPastDateIssues only flags a date actually
  // changed since this, so an untouched past date stays saveable.
  const lastSavedRef = useRef<ScheduleValues>(initial);

  const opensAtRef = useRef<HTMLInputElement | null>(null);
  const closesAtRef = useRef<HTMLInputElement | null>(null);
  const fieldRefs = { opensAt: opensAtRef, closesAt: closesAtRef };

  // Drives Clear-button visibility only — badInputFromRefs() is the
  // authority read at commit time, since it can't go stale mid-render.
  const [incomplete, setIncomplete] = useState<
    Record<keyof ScheduleValues, boolean>
  >({ opensAt: false, closesAt: false });

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

  function badInputFromRefs(): Record<keyof ScheduleValues, boolean> {
    return {
      opensAt: opensAtRef.current?.validity.badInput ?? false,
      closesAt: closesAtRef.current?.validity.badInput ?? false,
    };
  }

  function commitIfValid() {
    form.clearErrors();
    const issues = positionScheduleIssues(
      form.getValues(),
      badInputFromRefs(),
      toOrgDayString(new Date()),
      lastSavedRef.current,
    );
    if (issues.length > 0) {
      for (const issue of issues)
        form.setError(issue.path, { message: issue.message });
      return issues;
    }
    scheduleAutosave.commit(form.getValues());
    return [];
  }

  function handleClear(
    name: keyof ScheduleValues,
    { restoreFocus }: { restoreFocus: boolean },
  ) {
    form.clearErrors();
    const issues = positionScheduleClearIssues(
      name,
      form.getValues(),
      badInputFromRefs(),
      toOrgDayString(new Date()),
      lastSavedRef.current,
    );
    // Only the sibling can block a clear now — decide before touching anything,
    // so a blocked clear never blanks the field it couldn't actually clear.
    if (issues.length > 0) {
      for (const issue of issues)
        form.setError(issue.path, { message: issue.message });
      form.setError(name, { message: POSITION_DATE_CLEAR_BLOCKED_ERROR });
      return;
    }

    const ref = fieldRefs[name].current;
    if (ref) ref.value = '';
    form.setValue(name, '', { shouldDirty: true });
    setIncomplete((prev) => ({ ...prev, [name]: false }));
    scheduleAutosave.commit({ ...form.getValues(), [name]: '' });
    if (restoreFocus) ref?.focus();
  }

  const statusText = autosaveStatusText(
    scheduleAutosave.status,
    scheduleAutosave.error,
  );

  return (
    <Form {...form}>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          {SCHEDULE_FIELDS.map((config) => (
            <FormField
              key={config.name}
              control={form.control}
              name={config.name}
              render={({ field }) => {
                const showClear =
                  Boolean(field.value) || incomplete[config.name];
                return (
                  <FormItem className="min-w-0">
                    <FormLabel>{config.label}</FormLabel>
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          type="date"
                          className="flex-1"
                          {...field}
                          ref={(node) => {
                            field.ref(node);
                            fieldRefs[config.name].current = node;
                          }}
                          onChange={(e) => {
                            field.onChange(e);
                            setIncomplete((prev) => ({
                              ...prev,
                              [config.name]: e.target.validity.badInput,
                            }));
                          }}
                          onBlur={() => {
                            field.onBlur();
                            commitIfValid();
                          }}
                        />
                      </FormControl>
                      <div className="w-11 shrink-0 md:w-9">
                        {showClear && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={config.clearLabel}
                            // Keeps focus on the input so its blur-commit can't re-render under the finger.
                            onPointerDown={(e) => e.preventDefault()}
                            onClick={(e) =>
                              handleClear(config.name, {
                                restoreFocus: e.detail === 0, // 0 = keyboard activation
                              })
                            }
                          >
                            <ACTION_ICONS.dismiss />
                          </Button>
                        )}
                      </div>
                    </div>
                    <FormDescription>
                      {field.value
                        ? status === 'draft' && config.draftSetDescription
                          ? config.draftSetDescription
                          : config.setDescription
                        : config.emptyDescription}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
          ))}
        </div>

        <div aria-live="polite">
          {showDraftOpenWarning && (
            <WarningCallout>
              <p>
                This position is still a draft. Ask an admin to open this
                position before{' '}
                <LocalTime
                  date={orgDayStart(watchedOpensAt)}
                  precision="date"
                  timeZone={ORG_TIMEZONE}
                />
                .
              </p>
            </WarningCallout>
          )}
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
