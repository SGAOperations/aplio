'use client';

import { type ReactNode, useState } from 'react';

import { CONCEPT_ICONS } from '@/lib/icons';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface ActivityPanelProps {
  description: string;
  children: ReactNode;
}

export function ActivityPanel({ description, children }: ActivityPanelProps) {
  const [open, setOpen] = useState(false);
  const ActivityIcon = CONCEPT_ICONS.activity;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open recent activity">
          <ActivityIcon className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex flex-col gap-0 p-0">
        <div className="border-b px-4 py-3 pr-12">
          <SheetTitle className="text-base">Recent activity</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
