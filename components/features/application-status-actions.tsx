'use client';

import { useRef, useState, useTransition } from 'react';

import { toast } from 'sonner';

import { loadApplicationStatusHistory } from '@/prisma/actions/applications';
import type { $Enums } from '@/prisma/client';

import { isNonReviewableApplicationStatus } from '@/lib/constants';
import { ACTION_ICONS } from '@/lib/icons';
import type { ApplicationStatusHistoryEntry } from '@/lib/types';
import { isError } from '@/lib/utils';

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

interface ApplicationStatusActionsProps {
  applicationId: string;
  currentStatus: $Enums.ApplicationStatus;
  applicantName?: string;
}

// Table row `⋯` menu only — the detail page's header actions live in
// application-status-header-actions.tsx and its dialog.
export function ApplicationStatusActions({
  applicationId,
  currentStatus,
  applicantName,
}: ApplicationStatusActionsProps) {
  const displayName = applicantName ?? 'this application';
  const { isPending, selectTarget, confirmDialogProps } =
    useApplicationStatusMove({ applicationId, applicantName });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [history, setHistory] = useState<ApplicationStatusHistoryEntry[]>([]);
  const [isHistoryLoading, startHistoryTransition] = useTransition();
  const [historyFailed, setHistoryFailed] = useState(false);
  const requestIdRef = useRef(0);

  if (isNonReviewableApplicationStatus(currentStatus)) return null;

  const isTerminalDecision =
    currentStatus === 'accepted' || currentStatus === 'rejected';

  // Opens immediately and fetches in the same handler — no table pre-fetch
  // of history for every visible row; re-fetches on every open.
  function openDialog() {
    const requestId = ++requestIdRef.current;
    setDialogOpen(true);
    setHistoryFailed(false);
    startHistoryTransition(async () => {
      try {
        const result = await loadApplicationStatusHistory({ applicationId });
        if (requestId !== requestIdRef.current) return;
        if (isError(result)) {
          setHistoryFailed(true);
          toast.error(result.error);
          return;
        }
        setHistory(result);
      } catch {
        if (requestId !== requestIdRef.current) return;
        setHistoryFailed(true);
        toast.error('Something went wrong. Please try again.');
      }
    });
  }

  return (
    <>
      {isTerminalDecision ? (
        // A decision is already made — a plain, non-primary button straight
        // to the override dialog, no dropdown to hold just one item.
        <Button variant="outline" size="sm" onClick={openDialog}>
          Change decision
        </Button>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Change status for ${displayName}`}
              disabled={isPending}
            >
              <ACTION_ICONS.more />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <ApplicationStatusMenu
              status={currentStatus}
              hoistNext={false}
              isPending={isPending}
              onSelect={selectTarget}
              onSeeMore={openDialog}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <ConfirmDialog {...confirmDialogProps} />
      <ApplicationStatusDialog
        applicationId={applicationId}
        applicantName={displayName}
        currentStatus={currentStatus}
        history={history}
        isHistoryLoading={isHistoryLoading}
        historyFailed={historyFailed}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
