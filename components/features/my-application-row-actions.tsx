'use client';

import { useState, useTransition } from 'react';

import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  deleteDraftApplication,
  reopenApplication,
  withdrawApplication,
} from '@/prisma/actions/applications';
import type { $Enums } from '@/prisma/client';

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
              Your draft application to &ldquo;{positionTitle}&rdquo; and all
              its answers will be permanently deleted. This can&apos;t be
              undone.
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
                    toast.success('Draft deleted');
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

  if (status === 'withdrawn') {
    return (
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label={`Re-open application for ${positionTitle}`}
          >
            Re-open
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-open this application?</AlertDialogTitle>
            <AlertDialogDescription>
              Your application to &ldquo;{positionTitle}&rdquo; will return to
              the review queue as Applied.
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
                    const result = await reopenApplication(applicationId);
                    if (result && isError(result)) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success('Application re-opened');
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
              Re-open
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Non-draft, non-withdrawn statuses (applied, reached_out, interview_scheduled, reviewing, accepted, rejected)
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
            from review. You can re-open it later to put it back in the queue.
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
