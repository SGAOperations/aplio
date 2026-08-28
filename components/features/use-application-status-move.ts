'use client';

import { useState, useTransition } from 'react';

import { toast } from 'sonner';

import { updateApplicationStatus } from '@/prisma/actions/applications';
import type { $Enums } from '@/prisma/client';

import { fireConfetti } from '@/lib/confetti';
import { APPLICATION_STATUS_LABELS } from '@/lib/constants';
import { getDecisionEmailWarning } from '@/lib/utils';

interface UseApplicationStatusMoveOptions {
  applicationId: string;
  applicantName?: string;
}

interface PerformMoveOptions {
  override?: boolean;
  onSettled?: () => void;
}

const CONFIRM_COPY = {
  accepted: {
    title: (name: string) => `Accept ${name}?`,
    description: (name?: string) =>
      `They'll see Accepted on their application and can no longer withdraw it. ${getDecisionEmailWarning(name)}`,
    confirmLabel: 'Accept',
    pendingLabel: 'Accepting…',
  },
  rejected: {
    title: (name: string) => `Reject ${name}?`,
    description: (name?: string) =>
      `They'll see Rejected on their application and can no longer withdraw it. ${getDecisionEmailWarning(name)}`,
    confirmLabel: 'Reject',
    pendingLabel: 'Rejecting…',
  },
} as const;

// Shared by the table row menu, the detail-page header actions, and the
// status dialog's Select/Undo — one performMove + confirm-dialog rendering
// so the three surfaces can't drift on toast copy or the Accept/Reject gate.
export function useApplicationStatusMove({
  applicationId,
  applicantName,
}: UseApplicationStatusMoveOptions) {
  const [isPending, startTransition] = useTransition();
  const [pendingTarget, setPendingTarget] =
    useState<$Enums.ApplicationStatus | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<'accepted' | 'rejected'>(
    'accepted',
  );
  const [confirmOverride, setConfirmOverride] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const displayName = applicantName ?? 'this application';

  function performMove(
    target: $Enums.ApplicationStatus,
    options: PerformMoveOptions = {},
  ) {
    setPendingTarget(target);
    startTransition(async () => {
      try {
        const result = await updateApplicationStatus({
          applicationId,
          status: target,
          override: options.override ?? false,
        });
        if (result && 'error' in result) {
          toast.error(result.error);
          return;
        }
        toast.success(`Moved to ${APPLICATION_STATUS_LABELS[target]}`);
        if (target === 'accepted') void fireConfetti();
      } catch {
        toast.error('Something went wrong. Please try again.');
      } finally {
        setPendingTarget(null);
        options.onSettled?.();
      }
    });
  }

  function openConfirm(target: 'accepted' | 'rejected', override = false) {
    setConfirmTarget(target);
    setConfirmOverride(override);
    setConfirmOpen(true);
  }

  // Accept/Reject always confirm first, regardless of caller; every other
  // target applies immediately.
  function selectTarget(
    target: $Enums.ApplicationStatus,
    options: PerformMoveOptions = {},
  ) {
    if (target === 'accepted' || target === 'rejected') {
      setConfirmOverride(options.override ?? false);
      setConfirmTarget(target);
      setConfirmOpen(true);
      return;
    }
    performMove(target, options);
  }

  const confirmCopy = CONFIRM_COPY[confirmTarget];

  // Spread onto <ConfirmDialog {...move.confirmDialogProps} /> at each call
  // site — this file stays .ts (no JSX) so it can't leak into a server file.
  const confirmDialogProps = {
    open: confirmOpen,
    onOpenChange: setConfirmOpen,
    title: confirmCopy.title(displayName),
    description: confirmCopy.description(applicantName),
    confirmLabel: confirmCopy.confirmLabel,
    pendingLabel: confirmCopy.pendingLabel,
    destructive: confirmTarget === 'rejected',
    isPending: isPending && pendingTarget === confirmTarget,
    onConfirm: () =>
      performMove(confirmTarget, {
        override: confirmOverride,
        onSettled: () => setConfirmOpen(false),
      }),
  };

  return {
    isPending,
    pendingTarget,
    performMove,
    openConfirm,
    selectTarget,
    confirmDialogProps,
  };
}
