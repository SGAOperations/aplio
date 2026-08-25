'use client';

import { useState, useTransition } from 'react';

import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  deleteDraftApplication,
  withdrawApplication,
} from '@/prisma/actions/applications';
import type { $Enums } from '@/prisma/client';

import { TERMINAL_DECISION_STATUSES } from '@/lib/constants';
import { isError } from '@/lib/utils';

import { RestoreDraftButton } from '@/components/features/restore-draft-button';
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
  deletedAt: Date | null;
}

export function MyApplicationRowActions({
  applicationId,
  status,
  positionTitle,
  deletedAt,
}: MyApplicationRowActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  if (deletedAt)
    return (
      <RestoreDraftButton
        applicationId={applicationId}
        positionTitle={positionTitle}
      />
    );

  if (status === 'draft') {
    return (
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            aria-label={`Delete draft for ${positionTitle}`}
          >
            Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              Your draft application to &ldquo;{positionTitle}&rdquo; will be
              marked deleted. Your answers are kept, so you can restore it from
              My Applications later.
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
                      description: 'Restore it from My Applications any time.',
                    });
                    setOpen(false);
                  } catch {
                    toast.error('Something went wrong');
                  }
                });
              }}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
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
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Withdraw
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
