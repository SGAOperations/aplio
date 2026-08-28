'use client';

import { useTransition } from 'react';

import { toast } from 'sonner';

import { createDraftApplication } from '@/prisma/actions/applications';

import { ACTION_ICONS, CONCEPT_ICONS } from '@/lib/icons';
import { isError } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface StartApplicationCardProps {
  positionId: string;
  hasDeletedDraft: boolean;
}

export function StartApplicationCard({
  positionId,
  hasDeletedDraft,
}: StartApplicationCardProps) {
  const [isPending, startTransition] = useTransition();

  function handleStart() {
    startTransition(async () => {
      try {
        const result = await createDraftApplication({ positionId });
        if (result && isError(result)) {
          toast.error(result.error);
          return;
        }
        toast.success(
          hasDeletedDraft
            ? 'Your saved answers are back'
            : 'Application started',
        );
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });
  }

  return (
    <Card className="gap-0 p-0">
      <CardContent className="flex flex-col gap-4 p-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <CONCEPT_ICONS.myApplication className="text-muted-foreground size-4" />
            Start your application
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">
            {hasDeletedDraft
              ? 'You deleted a draft for this position. Starting again brings your saved answers back — you can change them before you submit.'
              : 'Your answers save as you go, so you can finish later.'}
          </p>
        </div>
        <Button className="w-fit" onClick={handleStart} disabled={isPending}>
          {isPending && <ACTION_ICONS.pending className="animate-spin" />}
          {isPending ? 'Starting…' : 'Start application'}
        </Button>
      </CardContent>
    </Card>
  );
}
