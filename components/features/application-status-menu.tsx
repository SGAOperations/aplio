'use client';

import type { $Enums } from '@/prisma/client';

import {
  APPLICATION_STATUS_ACTION_LABELS,
  getApplicationStatusMenu,
} from '@/lib/constants';

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface ApplicationStatusMenuProps {
  status: $Enums.ApplicationStatus;
  // Detail page hoists the next step out as the split button's main action,
  // so the menu starts at the decisions group; the table row has no
  // top-level button, so the next step is the first item instead.
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
          <DropdownMenuSeparator />
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
