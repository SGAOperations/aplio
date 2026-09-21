'use client';

import { useState, useTransition } from 'react';

import { toast } from 'sonner';

import { forceWithdrawApplication } from '@/prisma/actions/applications';
import type { $Enums } from '@/prisma/client';

import {
  APPLICATION_STATUS_LABELS,
  isTerminalDecisionApplicationStatus,
} from '@/lib/constants';

interface UseForceWithdrawApplicationOptions {
  applicationId: string;
  applicantName?: string;
  currentStatus: $Enums.ApplicationStatus;
}

// Kept .ts (no JSX), same reason as use-application-status-move.ts — three
// hosts (dialog, header actions, table row) share it rather than duplicating.
export function useForceWithdrawApplication({
  applicationId,
  applicantName,
  currentStatus,
}: UseForceWithdrawApplicationOptions) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const displayName = applicantName ?? 'this application';

  function performForceWithdraw(onSettled?: () => void) {
    startTransition(async () => {
      try {
        const result = await forceWithdrawApplication({ applicationId });
        if (result && 'error' in result) {
          toast.error(result.error);
          return;
        }
        toast.success('Application force-withdrawn', {
          description: `${displayName} was not notified.`,
        });
      } catch {
        toast.error('Something went wrong. Please try again.');
      } finally {
        onSettled?.();
      }
    });
  }

  function openConfirm() {
    setConfirmOpen(true);
  }

  const description = isTerminalDecisionApplicationStatus(currentStatus)
    ? `This moves ${displayName}'s application from ${APPLICATION_STATUS_LABELS[currentStatus]} to Withdrawn. ${displayName} is not notified — no email is sent. They can edit and resubmit it, which puts it back in the queue as Applied. The change is recorded in the status history under your name. ${displayName} has already been told they were ${APPLICATION_STATUS_LABELS[currentStatus]}, and will not be told that changed.`
    : `This moves ${displayName}'s application from ${APPLICATION_STATUS_LABELS[currentStatus]} to Withdrawn. ${displayName} is not notified — no email is sent. They can edit and resubmit it, which puts it back in the queue as Applied. The change is recorded in the status history under your name.`;

  const confirmDialogProps = {
    open: confirmOpen,
    onOpenChange: setConfirmOpen,
    title: `Force withdraw ${displayName}'s application?`,
    description,
    confirmLabel: 'Force withdraw',
    pendingLabel: 'Withdrawing…',
    destructive: true,
    isPending,
    onConfirm: () => performForceWithdraw(() => setConfirmOpen(false)),
  };

  return { isPending, openConfirm, confirmDialogProps };
}
