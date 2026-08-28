'use client';

import { useState } from 'react';

import type { $Enums } from '@/prisma/client';

import {
  APPLICATION_STATUS_LABELS,
  REVIEWER_APPLICATION_STATUS_OPTIONS,
  getApplicationStatusUndoTarget,
  isNonReviewableApplicationStatus,
} from '@/lib/constants';
import { ACTION_ICONS } from '@/lib/icons';
import type {
  ApplicationStatusHistoryEntry,
  DecisionEmailNoticeState,
} from '@/lib/types';
import {
  getApplicationStatusHistoryRowLabel,
  getDecisionEmailWarning,
  getUndoDecisionEmailNotice,
} from '@/lib/utils';

import { useApplicationStatusMove } from '@/components/features/use-application-status-move';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { LocalTime } from '@/components/ui/local-time';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const UNDO_NOTICE_ID = 'status-dialog-undo-notice';

interface ApplicationStatusDialogProps {
  applicationId: string;
  applicantName: string;
  currentStatus: $Enums.ApplicationStatus;
  history: ApplicationStatusHistoryEntry[];
  // Only the table row's dialog fetches on open — the detail page passes
  // its pre-fetched history and leaves these unset.
  isHistoryLoading?: boolean;
  historyFailed?: boolean;
  decisionEmailState: DecisionEmailNoticeState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApplicationStatusDialog({
  applicationId,
  applicantName,
  currentStatus,
  history,
  isHistoryLoading = false,
  historyFailed = false,
  decisionEmailState,
  open,
  onOpenChange,
}: ApplicationStatusDialogProps) {
  const [selectedStatus, setSelectedStatus] = useState<
    $Enums.ApplicationStatus | ''
  >('');
  const move = useApplicationStatusMove({ applicationId, applicantName });

  const canOverride = !isNonReviewableApplicationStatus(currentStatus);
  const undoTarget = getApplicationStatusUndoTarget(history[0] ?? null);
  const selectingDecision =
    selectedStatus === 'accepted' || selectedStatus === 'rejected';
  const undoNotice =
    (currentStatus === 'accepted' || currentStatus === 'rejected') && undoTarget
      ? getUndoDecisionEmailNotice(decisionEmailState, currentStatus)
      : null;

  function handleApply() {
    if (!selectedStatus) return;
    move.selectTarget(selectedStatus, {
      override: true,
      onSettled: () => setSelectedStatus(''),
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Application status</DialogTitle>
            <DialogDescription>
              Change the status, undo the last change, or review the history.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
            {canOverride && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Change status</h3>
                <div className="flex items-center gap-2">
                  <Label htmlFor="status-dialog-select" className="sr-only">
                    New status
                  </Label>
                  <Select
                    value={selectedStatus}
                    onValueChange={(v) =>
                      setSelectedStatus(v as $Enums.ApplicationStatus)
                    }
                    disabled={move.isPending}
                  >
                    <SelectTrigger
                      id="status-dialog-select"
                      aria-describedby="status-dialog-select-hint"
                      className="w-full"
                    >
                      <SelectValue placeholder="Choose a status" />
                    </SelectTrigger>
                    <SelectContent>
                      {REVIEWER_APPLICATION_STATUS_OPTIONS.filter(
                        (o) => o.value !== currentStatus,
                      ).map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={!selectedStatus || move.isPending}
                    onClick={handleApply}
                  >
                    {move.isPending &&
                      move.pendingTarget === selectedStatus && (
                        <ACTION_ICONS.pending className="animate-spin" />
                      )}
                    Apply
                  </Button>
                </div>
                {selectingDecision && (
                  <p role="status" className="text-muted-foreground text-xs">
                    {getDecisionEmailWarning(applicantName)}
                  </p>
                )}
                <p
                  id="status-dialog-select-hint"
                  className="text-muted-foreground text-xs"
                >
                  Any status, including moves the normal flow doesn&apos;t
                  offer.
                </p>
              </div>
            )}

            {canOverride && undoTarget && (
              <div className="flex flex-col items-start gap-1">
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto w-fit p-0"
                  disabled={move.isPending}
                  aria-describedby={undoNotice ? UNDO_NOTICE_ID : undefined}
                  onClick={() =>
                    move.selectTarget(undoTarget, { override: true })
                  }
                >
                  {move.isPending && move.pendingTarget === undoTarget && (
                    <ACTION_ICONS.pending className="animate-spin" />
                  )}
                  Undo — back to {APPLICATION_STATUS_LABELS[undoTarget]}
                </Button>
                {undoNotice && (
                  <p
                    id={UNDO_NOTICE_ID}
                    role="status"
                    className="text-muted-foreground text-xs"
                  >
                    {undoNotice}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">History</h3>
              {isHistoryLoading ? (
                <div
                  aria-busy="true"
                  aria-label="Loading history"
                  className="flex flex-col gap-2"
                >
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                </div>
              ) : historyFailed ? (
                <p className="text-muted-foreground text-sm">
                  Couldn&apos;t load the history. Close this and try again.
                </p>
              ) : history.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No status changes recorded yet.
                </p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {history.map((entry) => (
                    <li key={entry.id} className="text-sm">
                      <span>{getApplicationStatusHistoryRowLabel(entry)}</span>
                      <span className="text-muted-foreground">
                        {' · '}
                        {entry.changedByName}
                        {' · '}
                        <LocalTime
                          date={entry.createdAt}
                          precision="datetime"
                        />
                      </span>
                      {entry.from === null && (
                        <span className="text-muted-foreground">
                          {' · before history tracking'}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog {...move.confirmDialogProps} />
    </>
  );
}
