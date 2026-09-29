'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

import { ACTION_ICONS } from '@/lib/icons';

import { usePositionSearch } from '@/components/features/position-search';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface ArchivedPositionsCollapsibleProps {
  ids: string[];
  children: ReactNode;
}

// Client leaf — only the open/closed toggle is stateful. Archived cards are
// server-rendered and passed in as children; no ManagedPosition data crosses
// into this client component. Collapsed by default.
export function ArchivedPositionsCollapsible({
  ids,
  children,
}: ArchivedPositionsCollapsibleProps) {
  const { isFiltering, matchIds, query } = usePositionSearch();
  const [userOpen, setUserOpen] = useState(false);
  // Tracks the normalized query at which the user last dismissed the auto-expand.
  const [dismissedQuery, setDismissedQuery] = useState('');

  const total = ids.length;
  const matched = ids.filter((id) => matchIds.has(id)).length;
  const normalizedQuery = query.trim().toLowerCase();

  if (isFiltering && matched === 0) return null;

  // Auto-expand when filtering reveals matches, unless the user already dismissed.
  const autoOpen =
    isFiltering && matched > 0 && dismissedQuery !== normalizedQuery;
  const open = userOpen || autoOpen;

  function handleOpenChange(next: boolean) {
    setUserOpen(next);
    if (!next) setDismissedQuery(normalizedQuery);
  }

  const label =
    isFiltering && matched < total
      ? `Archived (${matched} of ${total})`
      : `Archived (${total})`;

  return (
    <Collapsible
      open={open}
      onOpenChange={handleOpenChange}
      className="flex flex-col gap-4"
    >
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="group w-full justify-between sm:w-auto sm:justify-start"
        >
          {label}
          <ACTION_ICONS.expand className="transition-transform group-data-[state=open]:rotate-180" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-4">
        <p className="text-muted-foreground text-xs">
          Closed more than 30 days ago, with no application status changes
          since.
        </p>
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
