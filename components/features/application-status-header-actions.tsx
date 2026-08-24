'use client';

import { useState } from 'react';

import type { $Enums } from '@/prisma/client';

import {
  APPLICATION_STATUS_ACTION_LABELS,
  NON_REVIEWABLE_APPLICATION_STATUS_NOTES,
  TERMINAL_DECISION_STATUS_NOTES,
  getApplicationStatusMenuGroups,
  isNonReviewableApplicationStatus,
} from '@/lib/constants';
import { ACTION_ICONS } from '@/lib/icons';
import type { ApplicationStatusHistoryEntry } from '@/lib/types';

import { ApplicationStatusDialog } from '@/components/features/application-status-dialog';
import { useApplicationStatusMove } from '@/components/features/use-application-status-move';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ApplicationStatusHeaderActionsProps {
  applicationId: string;
  currentStatus: $Enums.ApplicationStatus;
  applicantName: string;
  history: ApplicationStatusHistoryEntry[];
}

// Fixed two-control budget in PageHeader's actions slot: a split button (or
// its degraded single-button form) plus the `⋯` that opens the status
// dialog. Move-backs never appear here — only in the dialog's any-status Select.
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

  const isTerminalDecision =
    currentStatus === 'accepted' || currentStatus === 'rejected';
  const { forward, decisions } = getApplicationStatusMenuGroups(currentStatus);
  // Reviewing's only forward step re-schedules an interview — a backward-feeling
  // move once already under review, so Accept leads instead.
  const leadWithAccept =
    currentStatus === 'reviewing' && decisions.includes('accepted');
  const mainTarget = leadWithAccept ? 'accepted' : forward[0];
  const restForward = leadWithAccept ? forward : forward.slice(1);
  const menuDecisions = leadWithAccept
    ? decisions.filter((target) => target !== 'accepted')
    : decisions;

  const decisionItems = menuDecisions.map((target) => (
    <DropdownMenuItem
      key={target}
      variant={target === 'rejected' ? 'destructive' : 'default'}
      onSelect={() => move.selectTarget(target)}
    >
      {APPLICATION_STATUS_ACTION_LABELS[target]}
    </DropdownMenuItem>
  ));

  return (
    <>
      {isTerminalDecision && (
        <p className="text-muted-foreground text-xs">
          {TERMINAL_DECISION_STATUS_NOTES[currentStatus]}
        </p>
      )}

      {!isTerminalDecision && mainTarget && (
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
              {restForward.map((target) => (
                <DropdownMenuItem
                  key={target}
                  onSelect={() => move.selectTarget(target)}
                >
                  {APPLICATION_STATUS_ACTION_LABELS[target]}
                </DropdownMenuItem>
              ))}
              {restForward.length > 0 && menuDecisions.length > 0 && (
                <DropdownMenuSeparator />
              )}
              {decisionItems}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {!isTerminalDecision && !mainTarget && decisions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 sm:min-h-9"
              disabled={move.isPending}
            >
              Change status
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">{decisionItems}</DropdownMenuContent>
        </DropdownMenu>
      )}

      {moreButton}
      <ConfirmDialog {...move.confirmDialogProps} />
      {dialog}
    </>
  );
}
