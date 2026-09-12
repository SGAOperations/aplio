'use client';

import { useState, useTransition } from 'react';

import { toast } from 'sonner';

import { updatePositionStatus } from '@/prisma/actions/position-actions';
import type { PositionStatus } from '@/prisma/client';

import {
  POSITION_PUBLISH_REQUIRES_ADMIN_NOTE,
  POSITION_REOPEN_PAST_CLOSE_HINT,
  POSITION_REOPEN_REQUIRES_ADMIN_NOTE,
  POSITION_TRANSITION_ACTIONS,
  POSITION_UNPUBLISH_BLOCKED_HINT,
  getPositionTransitionTargets,
} from '@/lib/constants';
import { ACTION_ICONS } from '@/lib/icons';
import { isError } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PositionStatusHeaderActionsProps {
  positionId: string;
  currentStatus: PositionStatus;
  isAdmin: boolean;
  hasApplications: boolean;
  closesAtPast: boolean;
  unresolvedApplicationCount: number;
}

// No legal move renders a muted explanation instead of a disabled button that leaves the reason unstated.
export function PositionStatusHeaderActions({
  positionId,
  currentStatus,
  isAdmin,
  hasApplications,
  closesAtPast,
  unresolvedApplicationCount,
}: PositionStatusHeaderActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [pendingTarget, setPendingTarget] = useState<PositionStatus | null>(
    null,
  );
  const [confirmTarget, setConfirmTarget] = useState<PositionStatus | null>(
    null,
  );

  const targets = getPositionTransitionTargets(isAdmin, currentStatus, {
    hasApplications,
    closesAtPast,
  });

  function performMove(target: PositionStatus) {
    setPendingTarget(target);
    startTransition(async () => {
      try {
        const result = await updatePositionStatus({
          id: positionId,
          status: target,
        });
        if (isError(result)) {
          toast.error(result.error);
          return;
        }
        const action = POSITION_TRANSITION_ACTIONS[currentStatus][target];
        toast.success(action?.successToast ?? 'Position updated');
      } catch (error) {
        console.error(error);
        toast.error('Something went wrong. Please try again.');
      } finally {
        setPendingTarget(null);
        setConfirmTarget(null);
      }
    });
  }

  const confirmAction = confirmTarget
    ? POSITION_TRANSITION_ACTIONS[currentStatus][confirmTarget]
    : undefined;

  const confirmDialog = (
    <ConfirmDialog
      open={confirmTarget !== null && !!confirmAction}
      onOpenChange={(open) => {
        if (!open && !isPending) setConfirmTarget(null);
      }}
      title={confirmAction?.confirmTitle ?? ''}
      description={
        confirmAction?.confirmDescription({ unresolvedApplicationCount }) ?? ''
      }
      confirmLabel={confirmAction?.confirmLabel ?? ''}
      pendingLabel={confirmAction?.pendingLabel ?? ''}
      isPending={isPending}
      onConfirm={() => {
        if (confirmTarget) performMove(confirmTarget);
      }}
    />
  );

  // Reopen is the only possible move from closed, so it's always rendered —
  // disabled with a tooltip explanation, never hidden, when it isn't legal yet.
  if (currentStatus === 'closed') {
    const reopenAction = POSITION_TRANSITION_ACTIONS.closed.open;
    if (!reopenAction) return null;
    const canReopen = targets.includes('open');
    const disabledReason = canReopen
      ? null
      : isAdmin
        ? POSITION_REOPEN_PAST_CLOSE_HINT
        : POSITION_REOPEN_REQUIRES_ADMIN_NOTE;

    const reopenButton = (
      <Button
        variant="default"
        size="sm"
        className="min-h-11 sm:min-h-9"
        disabled={isPending || !canReopen}
        onClick={() => setConfirmTarget('open')}
      >
        {isPending && pendingTarget === 'open' && (
          <ACTION_ICONS.pending className="animate-spin" />
        )}
        {reopenAction.label}
      </Button>
    );

    return (
      <>
        {disabledReason ? (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>{reopenButton}</span>
              </TooltipTrigger>
              <TooltipContent>{disabledReason}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          reopenButton
        )}
        {confirmDialog}
      </>
    );
  }

  if (targets.length === 0) {
    const note =
      currentStatus === 'draft' && !isAdmin
        ? POSITION_PUBLISH_REQUIRES_ADMIN_NOTE
        : hasApplications
          ? POSITION_UNPUBLISH_BLOCKED_HINT
          : null;
    return note ? (
      <p className="text-muted-foreground text-xs">{note}</p>
    ) : null;
  }

  const [primaryTarget, ...restTargets] = targets;
  const primaryAction = primaryTarget
    ? POSITION_TRANSITION_ACTIONS[currentStatus][primaryTarget]
    : undefined;

  if (!primaryTarget || !primaryAction) return null;

  return (
    <>
      <div className="flex">
        <Button
          variant="default"
          size="sm"
          className={
            restTargets.length > 0
              ? 'min-h-11 rounded-r-none sm:min-h-9'
              : 'min-h-11 sm:min-h-9'
          }
          disabled={isPending}
          onClick={() => setConfirmTarget(primaryTarget)}
        >
          {isPending && pendingTarget === primaryTarget && (
            <ACTION_ICONS.pending className="animate-spin" />
          )}
          {primaryAction.label}
        </Button>
        {restTargets.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="default"
                size="sm"
                className="min-h-11 rounded-l-none border-l px-2 sm:min-h-9"
                aria-label="More status options"
              >
                <ACTION_ICONS.expand />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {restTargets.map((target) => {
                const action =
                  POSITION_TRANSITION_ACTIONS[currentStatus][target];
                if (!action) return null;
                return (
                  <DropdownMenuItem
                    key={target}
                    onSelect={() => setConfirmTarget(target)}
                  >
                    {action.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {confirmDialog}
    </>
  );
}
