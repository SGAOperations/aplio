'use client';

import { useState } from 'react';

import type { $Enums } from '@/prisma/client';

import {
  APPLICATION_STATUS_ACTION_LABELS,
  NON_REVIEWABLE_APPLICATION_STATUS_NOTES,
  TERMINAL_DECISION_STATUS_NOTES,
  getNextApplicationStatus,
  isNonReviewableApplicationStatus,
  isTerminalDecisionApplicationStatus,
} from '@/lib/constants';
import { ACTION_ICONS } from '@/lib/icons';
import type { ApplicationStatusHistoryEntry } from '@/lib/types';

import { ApplicationStatusDialog } from '@/components/features/application-status-dialog';
import { ApplicationStatusMenu } from '@/components/features/application-status-menu';
import { useApplicationStatusMove } from '@/components/features/use-application-status-move';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ApplicationStatusHeaderActionsProps {
  applicationId: string;
  currentStatus: $Enums.ApplicationStatus;
  applicantName: string;
  applicantEmail: string;
  history: ApplicationStatusHistoryEntry[];
}

// PageHeader's actions slot: an unresolved status gets a split button whose
// caret dropdown includes "See more" to open the status dialog; every other
// status (terminal decision or non-reviewable) gets a standalone caret with
// the same dropdown, since there's no next step to make primary. Drafts
// never reach this component — getApplicationForReview is listable-scoped.
// Move-backs never appear here — only in the dialog's any-status Select.
export function ApplicationStatusHeaderActions({
  applicationId,
  currentStatus,
  applicantName,
  applicantEmail,
  history,
}: ApplicationStatusHeaderActionsProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const move = useApplicationStatusMove({
    applicationId,
    applicantName,
    applicantEmail,
    currentStatus,
  });

  const dialog = (
    <ApplicationStatusDialog
      applicationId={applicationId}
      applicantName={applicantName}
      applicantEmail={applicantEmail}
      currentStatus={currentStatus}
      history={history}
      open={dialogOpen}
      onOpenChange={setDialogOpen}
    />
  );
  const confirmDialog = <ConfirmDialog {...move.confirmDialogProps} />;

  // The dialog's Select still offers a move for both terminals — only
  // withdrawn (the sole non-reviewable status reachable here) loses it.
  const isChangeable = !isNonReviewableApplicationStatus(currentStatus);

  const note = isTerminalDecisionApplicationStatus(currentStatus)
    ? TERMINAL_DECISION_STATUS_NOTES[currentStatus]
    : isNonReviewableApplicationStatus(currentStatus)
      ? NON_REVIEWABLE_APPLICATION_STATUS_NOTES[currentStatus]
      : null;

  if (note !== null) {
    return (
      <>
        <p className="text-muted-foreground text-xs">{note}</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="min-h-11 sm:min-h-9"
              aria-label={
                isChangeable
                  ? `More status options for ${applicantName}`
                  : `Status history for ${applicantName}`
              }
            >
              <ACTION_ICONS.expand />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <ApplicationStatusMenu
              status={currentStatus}
              hoistNext={false}
              isPending={move.isPending}
              onSelect={move.selectTarget}
              onSeeMore={() => setDialogOpen(true)}
            />
          </DropdownMenuContent>
        </DropdownMenu>
        {confirmDialog}
        {dialog}
      </>
    );
  }

  // Every unresolved status has a next step on the path (reviewing's is accepted).
  const mainTarget = getNextApplicationStatus(currentStatus);
  if (!mainTarget) return null;

  return (
    <>
      <div className="flex">
        <Button
          variant="default"
          size="sm"
          className="min-h-11 rounded-r-none sm:min-h-9"
          disabled={move.isPending}
          onClick={() => move.selectTarget(mainTarget)}
        >
          {move.isPending && move.pendingTarget === mainTarget && (
            <ACTION_ICONS.pending className="animate-spin" />
          )}
          {APPLICATION_STATUS_ACTION_LABELS[mainTarget]}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="default"
              size="sm"
              className="min-h-11 rounded-l-none border-l px-2 sm:min-h-9"
              aria-label={`More status options for ${applicantName}`}
            >
              <ACTION_ICONS.expand />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <ApplicationStatusMenu
              status={currentStatus}
              hoistNext
              isPending={move.isPending}
              onSelect={move.selectTarget}
              onSeeMore={() => setDialogOpen(true)}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {confirmDialog}
      {dialog}
    </>
  );
}
