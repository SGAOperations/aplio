'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { updatePosition } from '@/prisma/actions/position-actions';
import type { PositionStatus } from '@/prisma/client';

import {
  POSITION_DRAFT_CLOSE_HINT,
  POSITION_OPEN_REQUIRES_ADMIN_HINT,
  POSITION_REOPEN_PAST_CLOSE_HINT,
  POSITION_UNPUBLISH_BLOCKED_HINT,
  type PositionFormValues,
  getPositionStatusOptions,
  makePositionFormSchema,
} from '@/lib/constants';
import { toOrgDayString } from '@/lib/dates';
import { ACTION_ICONS } from '@/lib/icons';

import { MarkdownField } from '@/components/features/markdown-field';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PositionDetailsFormProps {
  position: {
    id: string;
    title: string;
    description: string;
    status: PositionStatus;
    opensAt: string | null;
    closesAt: string | null;
  };
  isAdmin: boolean;
  hasApplications: boolean;
  unresolvedApplicationCount: number;
  // Server-rendered warning callout(s) about a status/date divergence, shown
  // right under the Status field so they read as one status-related section.
  statusNotice?: ReactNode;
}

function closeConfirmDescription(count: number): string {
  const application = count === 1 ? 'application is' : 'applications are';
  return `${count} ${application} still in progress. Closing stops new applications; the ones you have stay reviewable.`;
}

const REOPEN_CONFIRM_DESCRIPTION =
  'This position becomes listed and applyable again. Existing applications and decisions are unchanged.';

// Always visible, not dialog-triggered: shadcn Form primitives directly, no FormDialog.
export function PositionDetailsForm({
  position,
  isAdmin,
  hasApplications,
  unresolvedApplicationCount,
  statusNotice,
}: PositionDetailsFormProps) {
  const schema = useMemo(
    () =>
      makePositionFormSchema(toOrgDayString(new Date()), {
        opensAt: position.opensAt ?? undefined,
        closesAt: position.closesAt ?? undefined,
      }),
    [position.opensAt, position.closesAt],
  );

  const form = useForm<PositionFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: position.title,
      description: position.description,
      status: position.status,
      opensAt: position.opensAt ?? '',
      closesAt: position.closesAt ?? '',
    },
  });
  const isSubmitting = form.formState.isSubmitting;

  const [pendingValues, setPendingValues] = useState<PositionFormValues | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const disabled = isSubmitting || isSaving;

  const watchedClosesAt = useWatch({ control: form.control, name: 'closesAt' });
  const closesAtPast =
    !!watchedClosesAt && watchedClosesAt < toOrgDayString(new Date());

  const statusOptions = getPositionStatusOptions(isAdmin, position.status, {
    hasApplications,
    closesAtPast,
  });

  // Precedence: reopen-past-close -> unpublish-blocked -> draft-close.
  const transitionHint =
    position.status === 'closed' && closesAtPast
      ? POSITION_REOPEN_PAST_CLOSE_HINT
      : hasApplications && position.status !== 'draft'
        ? POSITION_UNPUBLISH_BLOCKED_HINT
        : position.status === 'draft'
          ? POSITION_DRAFT_CLOSE_HINT
          : null;
  const showAdminHint = !isAdmin && position.status !== 'open';

  async function save(data: PositionFormValues) {
    setIsSaving(true);
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
    } finally {
      setIsSaving(false);
      setPendingValues(null);
    }
  }

  function onSubmit(data: PositionFormValues) {
    const needsCloseConfirm =
      position.status === 'open' &&
      data.status === 'closed' &&
      unresolvedApplicationCount > 0;
    const needsReopenConfirm =
      position.status === 'closed' && data.status === 'open';

    if (needsCloseConfirm || needsReopenConfirm) {
      setPendingValues(data);
      return;
    }
    void save(data);
  }

  const confirmMove: 'close' | 'reopen' | null =
    pendingValues === null
      ? null
      : pendingValues.status === 'closed'
        ? 'close'
        : 'reopen';

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
        className="flex flex-col gap-4"
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input disabled={disabled} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <MarkdownField />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
                disabled={disabled || statusOptions.length <= 1}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(showAdminHint || transitionHint) && (
                <FormDescription>
                  {showAdminHint && (
                    <span className="block">
                      {POSITION_OPEN_REQUIRES_ADMIN_HINT}
                    </span>
                  )}
                  {transitionHint && (
                    <span className="block">{transitionHint}</span>
                  )}
                </FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {statusNotice}

        <div className="grid gap-2 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="opensAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Opens At</FormLabel>
                <FormControl>
                  <Input type="date" disabled={disabled} {...field} />
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
                  <Input type="date" disabled={disabled} {...field} />
                </FormControl>
                <FormDescription>
                  Applications close at 11:59 PM Eastern on this day.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div>
          <Button type="submit" disabled={disabled}>
            {disabled ? (
              <ACTION_ICONS.pending className="animate-spin" />
            ) : (
              <ACTION_ICONS.save />
            )}
            Save Changes
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmMove !== null}
        onOpenChange={(open) => {
          if (!open && !isSaving) setPendingValues(null);
        }}
        title={
          confirmMove === 'close'
            ? 'Close this position?'
            : 'Reopen this position?'
        }
        description={
          confirmMove === 'close'
            ? closeConfirmDescription(unresolvedApplicationCount)
            : REOPEN_CONFIRM_DESCRIPTION
        }
        confirmLabel={
          confirmMove === 'close' ? 'Close position' : 'Reopen position'
        }
        pendingLabel={confirmMove === 'close' ? 'Closing…' : 'Reopening…'}
        isPending={isSaving}
        onConfirm={() => {
          if (pendingValues) void save(pendingValues);
        }}
      />
    </Form>
  );
}
