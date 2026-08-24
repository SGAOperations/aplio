'use client';

import type { ReactNode } from 'react';

import { ACTION_ICONS } from '@/lib/icons';

import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface ArchivedPositionsCollapsibleProps {
  count: number;
  children: ReactNode;
}

// Client leaf — only the open/closed toggle is stateful. Archived cards are
// server-rendered and passed in as children; no ManagedPosition data crosses
// into this client component. Collapsed by default.
export function ArchivedPositionsCollapsible({
  count,
  children,
}: ArchivedPositionsCollapsibleProps) {
  return (
    <Collapsible className="flex flex-col gap-4">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="group w-full justify-between sm:w-auto sm:justify-start"
        >
          Archived ({count})
          <ACTION_ICONS.expand className="transition-transform group-data-[state=open]:rotate-180" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-4">
        <p className="text-muted-foreground text-xs">
          Closed more than 30 days ago, with no applications in progress.
        </p>
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
