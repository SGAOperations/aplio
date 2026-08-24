'use client';

import { MoreHorizontal } from 'lucide-react';

import type { $Enums } from '@/prisma/client';

import {
  APPLICATION_STATUS_ACTION_LABELS,
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_TRANSITIONS,
  getApplicationStatusMenuGroups,
  isNonReviewableApplicationStatus,
} from '@/lib/constants';

import { useApplicationStatusMove } from '@/components/features/use-application-status-move';
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

  if (isNonReviewableApplicationStatus(currentStatus)) return null;

  const { forward, decisions } = getApplicationStatusMenuGroups(currentStatus);
  const { back } = APPLICATION_STATUS_TRANSITIONS[currentStatus];

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
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {forward.map((target) => (
            <DropdownMenuItem
              key={target}
              onSelect={() => selectTarget(target)}
            >
              {APPLICATION_STATUS_ACTION_LABELS[target]}
            </DropdownMenuItem>
          ))}
          {decisions.length > 0 && forward.length > 0 && (
            <DropdownMenuSeparator />
          )}
          {decisions.map((target) => (
            <DropdownMenuItem
              key={target}
              variant={target === 'rejected' ? 'destructive' : 'default'}
              onSelect={() => selectTarget(target)}
            >
              {APPLICATION_STATUS_ACTION_LABELS[target]}
            </DropdownMenuItem>
          ))}
          {back.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Move back</DropdownMenuLabel>
              {back.map((target) => (
                <DropdownMenuItem
                  key={target}
                  onSelect={() => selectTarget(target)}
                >
                  Move back to {APPLICATION_STATUS_LABELS[target]}
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog {...confirmDialogProps} />
    </>
  );
}
