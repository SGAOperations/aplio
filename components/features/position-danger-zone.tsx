'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { deletePosition } from '@/prisma/actions/position-actions';

import type { PositionDeletionSummary } from '@/lib/types';
import { isError } from '@/lib/utils';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PositionDangerZoneProps {
  positionId: string;
  positionTitle: string;
  summary: PositionDeletionSummary;
}

export function PositionDangerZone({
  positionId,
  positionTitle,
  summary,
}: PositionDangerZoneProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const blocked = summary.submittedCount > 0;
  const blockedReasonId = `delete-position-blocked-${positionId}`;

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive">Delete position</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">
          Deleting hides this position everywhere — the positions list, search
          results and any direct link. This can&apos;t be undone from the app.
        </p>

        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              disabled={blocked}
              aria-label={`Delete position ${positionTitle}`}
              aria-describedby={blocked ? blockedReasonId : undefined}
              className="self-start"
            >
              Delete position
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete &ldquo;{positionTitle}&rdquo;?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This position will be hidden from everyone, including anyone
                holding a direct link. This can&apos;t be undone from the app.
                {summary.draftCount > 0 && (
                  <>
                    {' '}
                    {summary.draftCount} unsubmitted draft application
                    {summary.draftCount === 1 ? '' : 's'} will disappear too.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={isPending}
                onClick={(e) => {
                  e.preventDefault();
                  startTransition(async () => {
                    try {
                      const result = await deletePosition({ id: positionId });
                      if (result && isError(result)) {
                        toast.error(result.error);
                        return;
                      }
                      toast.success('Position deleted');
                      setOpen(false);
                      router.push('/my-positions');
                    } catch {
                      toast.error('Something went wrong. Please try again.');
                    }
                  });
                }}
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                Delete position
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {blocked && (
          <p id={blockedReasonId} className="text-muted-foreground text-sm">
            This position has {summary.submittedCount} application
            {summary.submittedCount === 1 ? '' : 's'}, so it can&apos;t be
            deleted. Close it instead — closed positions stay in the archive.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
