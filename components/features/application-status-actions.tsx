'use client';

import { useRef, useState, useTransition } from 'react';

import { toast } from 'sonner';

import {
  loadApplicationStatusHistory,
  loadDecisionEmailNotice,
} from '@/prisma/actions/applications';
import type { $Enums } from '@/prisma/client';

import {
  isNonReviewableApplicationStatus,
  isTerminalDecisionApplicationStatus,
} from '@/lib/constants';
import { ACTION_ICONS } from '@/lib/icons';
import type {
  ApplicationStatusHistoryEntry,
  DecisionEmailNoticeState,
} from '@/lib/types';
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
  const [decisionEmailState, setDecisionEmailState] =
    useState<DecisionEmailNoticeState>(null);
  const requestIdRef = useRef(0);

  if (isNonReviewableApplicationStatus(currentStatus)) return null;
  if (isTerminalDecisionApplicationStatus(currentStatus)) return null;

  // Opens immediately and fetches in the same handler — no table pre-fetch
  // of history (or the decision-email notice) for every visible row;
  // re-fetches on every open.
  function openDialog() {
    const requestId = ++requestIdRef.current;
    setDialogOpen(true);
    setHistoryFailed(false);
    setDecisionEmailState(null);
    startHistoryTransition(async () => {
      const noticePromise = loadDecisionEmailNotice({
        applicationId,
        currentStatus,
      });
      try {
        const result = await loadApplicationStatusHistory({ applicationId });
        if (requestId !== requestIdRef.current) return;
        if (isError(result)) {
          setHistoryFailed(true);
          toast.error(result.error);
        } else {
          setHistory(result);
        }
      } catch {
        if (requestId !== requestIdRef.current) return;
        setHistoryFailed(true);
        toast.error('Something went wrong. Please try again.');
      }

      const notice = await noticePromise.catch(() => null);
      if (requestId !== requestIdRef.current) return;
      setDecisionEmailState(!notice || isError(notice) ? null : notice);
    });
  }

  return (
    <>
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
      <ConfirmDialog {...confirmDialogProps} />
      <ApplicationStatusDialog
        applicationId={applicationId}
        applicantName={displayName}
        currentStatus={currentStatus}
        history={history}
        isHistoryLoading={isHistoryLoading}
        historyFailed={historyFailed}
        decisionEmailState={decisionEmailState}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
