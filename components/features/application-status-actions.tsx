'use client';

import { useState, useTransition } from 'react';

import { Loader2, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';

import { updateApplicationStatus } from '@/prisma/actions/applications';
import type { $Enums } from '@/prisma/client';

import {
  APPLICATION_STATUS_ACTION_LABELS,
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_TRANSITIONS,
  NON_REVIEWABLE_APPLICATION_STATUS_NOTES,
  REJECTABLE_APPLICATION_STATUSES,
  TERMINAL_DECISION_STATUS_NOTES,
  isNonReviewableApplicationStatus,
} from '@/lib/constants';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ApplicationStatusActionsProps {
  applicationId: string;
  currentStatus: $Enums.ApplicationStatus;
  applicantName?: string;
  compact?: boolean;
}

const CONFIRM_COPY = {
  accepted: {
    title: (name: string) => `Accept ${name}?`,
    description:
      "They'll see Accepted on their application and can no longer withdraw it. You can move this back later.",
    confirmLabel: 'Accept',
    pendingLabel: 'Accepting…',
  },
  rejected: {
    title: (name: string) => `Reject ${name}?`,
    description:
      "They'll see Rejected on their application and can no longer withdraw it. You can move this back later.",
    confirmLabel: 'Reject',
    pendingLabel: 'Rejecting…',
  },
} as const;

export function ApplicationStatusActions({
  applicationId,
  currentStatus,
  applicantName,
  compact,
}: ApplicationStatusActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [pendingTarget, setPendingTarget] =
    useState<$Enums.ApplicationStatus | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<'accepted' | 'rejected'>(
    'accepted',
  );
  const [confirmOpen, setConfirmOpen] = useState(false);

  const displayName = applicantName ?? 'this application';

  function performMove(
    target: $Enums.ApplicationStatus,
    onSettled?: () => void,
  ) {
    setPendingTarget(target);
    startTransition(async () => {
      try {
        const result = await updateApplicationStatus({
          applicationId,
          status: target,
        });
        if (result && 'error' in result) {
          toast.error(result.error);
          return;
        }
        toast.success(`Moved to ${APPLICATION_STATUS_LABELS[target]}`);
      } catch {
        toast.error('Something went wrong. Please try again.');
      } finally {
        setPendingTarget(null);
        onSettled?.();
      }
    });
  }

  function openConfirm(target: 'accepted' | 'rejected') {
    setConfirmTarget(target);
    setConfirmOpen(true);
  }

  function handleForwardSelect(target: $Enums.ApplicationStatus) {
    if (target === 'accepted') openConfirm('accepted');
    else performMove(target);
  }

  if (isNonReviewableApplicationStatus(currentStatus)) {
    if (compact) return null;
    return (
      <p className="text-muted-foreground text-xs">
        {NON_REVIEWABLE_APPLICATION_STATUS_NOTES[currentStatus]}
      </p>
    );
  }

  const isTerminalDecision =
    currentStatus === 'accepted' || currentStatus === 'rejected';
  const { forward, back } = APPLICATION_STATUS_TRANSITIONS[currentStatus];
  const isRejectable = (
    REJECTABLE_APPLICATION_STATUSES as readonly $Enums.ApplicationStatus[]
  ).includes(currentStatus);

  const confirmCopy = CONFIRM_COPY[confirmTarget];

  const confirmDialog = (
    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      title={confirmCopy.title(displayName)}
      description={confirmCopy.description}
      confirmLabel={confirmCopy.confirmLabel}
      pendingLabel={confirmCopy.pendingLabel}
      destructive={confirmTarget === 'rejected'}
      isPending={isPending && pendingTarget === confirmTarget}
      onConfirm={() => performMove(confirmTarget, () => setConfirmOpen(false))}
    />
  );

  if (compact) {
    return (
      <>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Change status for ${displayName}`}
            >
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {forward.map((target) => (
              <DropdownMenuItem
                key={target}
                onSelect={(e) => {
                  e.preventDefault();
                  setMenuOpen(false);
                  handleForwardSelect(target);
                }}
              >
                {APPLICATION_STATUS_ACTION_LABELS[target]}
              </DropdownMenuItem>
            ))}
            {isRejectable && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={(e) => {
                    e.preventDefault();
                    setMenuOpen(false);
                    openConfirm('rejected');
                  }}
                >
                  {APPLICATION_STATUS_ACTION_LABELS.rejected}
                </DropdownMenuItem>
              </>
            )}
            {back.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Move back</DropdownMenuLabel>
                {back.map((target) => (
                  <DropdownMenuItem
                    key={target}
                    onSelect={(e) => {
                      e.preventDefault();
                      setMenuOpen(false);
                      performMove(target);
                    }}
                  >
                    Move back to {APPLICATION_STATUS_LABELS[target]}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        {confirmDialog}
      </>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {isTerminalDecision && (
        <p className="text-muted-foreground text-xs">
          {TERMINAL_DECISION_STATUS_NOTES[currentStatus]}
        </p>
      )}
      {!isTerminalDecision &&
        forward.map((target, i) => (
          <Button
            key={target}
            variant={i === 0 ? 'default' : 'outline'}
            size="sm"
            className="min-h-11 sm:min-h-9"
            disabled={isPending}
            onClick={() => handleForwardSelect(target)}
          >
            {isPending && pendingTarget === target && (
              <Loader2 className="animate-spin" aria-hidden />
            )}
            {APPLICATION_STATUS_ACTION_LABELS[target]}
          </Button>
        ))}
      {!isTerminalDecision && isRejectable && (
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive min-h-11 sm:min-h-9"
          disabled={isPending}
          onClick={() => openConfirm('rejected')}
        >
          {isPending && pendingTarget === 'rejected' && (
            <Loader2 className="animate-spin" aria-hidden />
          )}
          {APPLICATION_STATUS_ACTION_LABELS.rejected}
        </Button>
      )}
      {back.map((target) => (
        <Button
          key={target}
          variant="ghost"
          size="sm"
          className="text-muted-foreground min-h-11 sm:min-h-9"
          disabled={isPending}
          onClick={() => performMove(target)}
        >
          {isPending && pendingTarget === target && (
            <Loader2 className="animate-spin" aria-hidden />
          )}
          Move back to {APPLICATION_STATUS_LABELS[target]}
        </Button>
      ))}
      {confirmDialog}
    </div>
  );
}
