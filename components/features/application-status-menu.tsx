'use client';

import type { $Enums } from '@/prisma/client';

import {
  APPLICATION_STATUS_ACTION_LABELS,
  getApplicationStatusMenu,
  isTerminalDecisionApplicationStatus,
} from '@/lib/constants';

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface ApplicationStatusMenuProps {
  status: $Enums.ApplicationStatus;
  // Detail page hoists next-step into the split button; table row doesn't.
  hoistNext: boolean;
  isPending?: boolean;
  onSelect: (target: $Enums.ApplicationStatus) => void;
  onSeeMore: () => void;
}

// One menu shape for both surfaces — the only prop that differs is hoistNext.
export function ApplicationStatusMenu({
  status,
  hoistNext,
  isPending = false,
  onSelect,
  onSeeMore,
}: ApplicationStatusMenuProps) {
  const { next, decisions } = getApplicationStatusMenu(status);
  const showNext = !hoistNext && next !== null;
  // No separator when next is itself a decision (reviewing -> accepted).
  const nextIsDecision =
    next !== null && isTerminalDecisionApplicationStatus(next);

  return (
    <>
      {showNext && (
        <>
          <DropdownMenuItem
            disabled={isPending}
            onSelect={() => onSelect(next)}
          >
            {APPLICATION_STATUS_ACTION_LABELS[next]}
          </DropdownMenuItem>
          {!nextIsDecision && <DropdownMenuSeparator />}
        </>
      )}
      {decisions.map((target) => (
        <DropdownMenuItem
          key={target}
          variant={target === 'rejected' ? 'destructive' : 'default'}
          disabled={isPending}
          onSelect={() => onSelect(target)}
        >
          {APPLICATION_STATUS_ACTION_LABELS[target]}
        </DropdownMenuItem>
      ))}
      {(showNext || decisions.length > 0) && <DropdownMenuSeparator />}
      <DropdownMenuItem onSelect={onSeeMore}>See more</DropdownMenuItem>
    </>
  );
}
