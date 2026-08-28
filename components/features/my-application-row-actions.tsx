'use client';

import { useState, useTransition } from 'react';

import { toast } from 'sonner';

import {
  deleteDraftApplication,
  withdrawApplication,
} from '@/prisma/actions/applications';
import type { $Enums } from '@/prisma/client';

import { TERMINAL_DECISION_STATUSES } from '@/lib/constants';
import { ACTION_ICONS } from '@/lib/icons';
import { isError } from '@/lib/utils';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface MyApplicationRowActionsProps {
  applicationId: string;
  status: $Enums.ApplicationStatus;
  positionTitle: string;
}

export function MyApplicationRowActions({
  applicationId,
  status,
  positionTitle,
}: MyApplicationRowActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  if (status === 'draft') {
    return (
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label={`Delete draft for ${positionTitle}`}
          >
            <ACTION_ICONS.delete />
            Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              Your draft application to &ldquo;{positionTitle}&rdquo; will be
              removed from My Applications. If you apply to this position again,
              your answers come back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={(e) => {
                e.preventDefault();
                startTransition(async () => {
                  try {
                    const result = await deleteDraftApplication(applicationId);
                    if (result && isError(result)) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success('Draft deleted', {
                      description:
                        'Apply to this position again to bring your answers back.',
                    });
                    setOpen(false);
                  } catch {
                    toast.error('Something went wrong');
                  }
                });
              }}
            >
              {isPending ? (
                <ACTION_ICONS.pending className="animate-spin" />
              ) : (
                <ACTION_ICONS.delete />
              )}
              Delete draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // withdrawn: the cell already carries the primary action (Edit & resubmit / Position closed).
  if (status === 'withdrawn') return null;

  if (TERMINAL_DECISION_STATUSES.includes(status))
    return (
      <span className="text-muted-foreground text-sm" aria-hidden="true">
        —
      </span>
    );

  // Non-draft, non-withdrawn, non-terminal statuses (applied, reached_out, interview_scheduled, reviewing)
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={`Withdraw application for ${positionTitle}`}
        >
          Withdraw
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Withdraw this application?</AlertDialogTitle>
          <AlertDialogDescription>
            Your application to &ldquo;{positionTitle}&rdquo; will be removed
            from review. You can edit and resubmit it later to put it back in
            the queue.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              startTransition(async () => {
                try {
                  const result = await withdrawApplication(applicationId);
                  if (result && isError(result)) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success('Application withdrawn');
                  setOpen(false);
                } catch {
                  toast.error('Something went wrong');
                }
              });
            }}
          >
            {isPending ? (
              <ACTION_ICONS.pending className="animate-spin" />
            ) : null}
            Withdraw
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
