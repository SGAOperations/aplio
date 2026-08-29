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
  history: ApplicationStatusHistoryEntry[];
}

// Fixed two-control budget in PageHeader's actions slot: a split button plus
// the `⋯` that opens the status dialog. Once a decision is made, both
// collapse into a single "Change decision" button. Move-backs never appear
// here — only in the dialog's any-status Select.
export function ApplicationStatusHeaderActions({
  applicationId,
  currentStatus,
  applicantName,
  history,
}: ApplicationStatusHeaderActionsProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const move = useApplicationStatusMove({ applicationId, applicantName });

  const moreButton = (
    <Button
      variant="outline"
      size="icon"
      className="min-h-11 sm:min-h-9"
      aria-label={`Status history and override for ${applicantName}`}
      onClick={() => setDialogOpen(true)}
    >
      <ACTION_ICONS.more />
    </Button>
  );

  // Non-primary — only reopens the override dialog, doesn't advance the application.
  const changeDecisionButton = (
    <Button
      variant="outline"
      size="sm"
      className="min-h-11 sm:min-h-9"
      onClick={() => setDialogOpen(true)}
    >
      Change decision
    </Button>
  );

  const dialog = (
    <ApplicationStatusDialog
      applicationId={applicationId}
      applicantName={applicantName}
      currentStatus={currentStatus}
      history={history}
      open={dialogOpen}
      onOpenChange={setDialogOpen}
    />
  );

  if (isNonReviewableApplicationStatus(currentStatus)) {
    return (
      <>
        <p className="text-muted-foreground text-xs">
          {NON_REVIEWABLE_APPLICATION_STATUS_NOTES[currentStatus]}
        </p>
        {moreButton}
        {dialog}
      </>
    );
  }

  const isTerminalDecision = isTerminalDecisionApplicationStatus(currentStatus);

  if (isTerminalDecision) {
    return (
      <>
        <p className="text-muted-foreground text-xs">
          {TERMINAL_DECISION_STATUS_NOTES[currentStatus]}
        </p>
        {changeDecisionButton}
        <ConfirmDialog {...move.confirmDialogProps} />
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

      {moreButton}
      <ConfirmDialog {...move.confirmDialogProps} />
      {dialog}
    </>
  );
}
