'use client';

import { useTransition } from 'react';

import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { createDraftApplication } from '@/prisma/actions/applications';

import { formatDate, isError } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface StartApplicationCardProps {
  positionId: string;
  positionQuestionCount: number;
  closesAt: Date | null;
}

export function StartApplicationCard({
  positionId,
  positionQuestionCount,
  closesAt,
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
        toast.success('Application started');
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });
  }

  return (
    <Card className="gap-0 p-0">
      <CardContent className="flex flex-col gap-4 p-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Start your application
          </h2>
          <ul className="text-muted-foreground mt-2 flex flex-col gap-1 text-sm">
            <li>
              Your profile answers are included automatically — you can
              customize them for this application.
            </li>
            {positionQuestionCount > 0 && (
              <li>
                {positionQuestionCount} question
                {positionQuestionCount === 1 ? '' : 's'} specific to this
                position.
              </li>
            )}
            <li>Your answers save as you go, so you can finish later.</li>
            {closesAt && <li>Applications close {formatDate(closesAt)}.</li>}
          </ul>
        </div>
        <Button className="w-fit" onClick={handleStart} disabled={isPending}>
          {isPending && (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          )}
          {isPending ? 'Starting…' : 'Start application'}
        </Button>
      </CardContent>
    </Card>
  );
}
