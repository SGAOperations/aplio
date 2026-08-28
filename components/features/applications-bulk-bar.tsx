'use client';

import { useState, useTransition } from 'react';

import { toast } from 'sonner';

import { updateApplicationStatuses } from '@/prisma/actions/applications';
import type { $Enums } from '@/prisma/client';

import {
  APPLICATION_STATUS_LABELS,
  REVIEWER_APPLICATION_STATUS_OPTIONS,
  getApplicationStatusForwardSources,
  isNonReviewableApplicationStatus,
} from '@/lib/constants';
import { ACTION_ICONS } from '@/lib/icons';
import type { ApplicationListRow } from '@/lib/types';
import { formatAlternatives, summarizeBulkStatusChange } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ApplicationsBulkBarProps {
  selected: ApplicationListRow[];
  onApplied: (retainedIds: string[]) => void;
  status: $Enums.ApplicationStatus | '';
  onStatusChange: (value: $Enums.ApplicationStatus | '') => void;
}

const HINT_ID = 'bulk-status-hint';

function applicationNoun(count: number): string {
  return count === 1 ? 'application' : 'applications';
}

export function ApplicationsBulkBar({
  selected,
  onApplied,
  status,
  onStatusChange,
}: ApplicationsBulkBarProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const count = selected.length;
  const countLabel = count === 1 ? '1 selected' : `${count} selected`;

  const { eligibleCount, skippedLabel } = summarizeBulkStatusChange(selected);
  const isRejecting = status === 'rejected';
  const statusLabel = status ? APPLICATION_STATUS_LABELS[status] : '';

  function handleConfirm() {
    if (!status) return;
    startTransition(async () => {
      try {
        const result = await updateApplicationStatuses({
          applicationIds: selected.map((a) => a.id),
          status,
        });
        if ('error' in result) {
          toast.error(result.error);
          return;
        }

        const { updated, skipped } = result;
        if (skipped === 0) {
          toast.success(`Updated ${updated} ${applicationNoun(updated)}`);
        } else {
          const sourceLabels = getApplicationStatusForwardSources(status).map(
            (source) => APPLICATION_STATUS_LABELS[source],
          );
          toast.success(
            `Updated ${updated} of ${updated + skipped} applications`,
            {
              description: `${statusLabel} is only reachable from ${formatAlternatives(sourceLabels)}.`,
            },
          );
        }

        setConfirmOpen(false);
        onApplied(
          selected
            .filter((a) => isNonReviewableApplicationStatus(a.status))
            .map((a) => a.id),
        );
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });
  }

  return (
    <div className="bg-muted/50 flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{countLabel}</span>
        {skippedLabel && (
          <span
            id={HINT_ID}
            role="status"
            className="text-muted-foreground text-xs"
          >
            {eligibleCount === 0
              ? "Nothing to update — withdrawn applications can't be changed."
              : `${skippedLabel} will be skipped.`}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="bulk-status" className="sr-only">
          Set status
        </Label>
        <Select
          value={status}
          onValueChange={(v) =>
            onStatusChange(v as $Enums.ApplicationStatus | '')
          }
          disabled={isPending}
        >
          <SelectTrigger id="bulk-status" className="w-44">
            <SelectValue placeholder="Set status..." />
          </SelectTrigger>
          <SelectContent>
            {REVIEWER_APPLICATION_STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          size="sm"
          variant={isRejecting ? 'destructive' : 'default'}
          onClick={() => setConfirmOpen(true)}
          disabled={isPending || !status || eligibleCount === 0}
          aria-describedby={skippedLabel ? HINT_ID : undefined}
        >
          {isPending ? (
            <>
              <ACTION_ICONS.pending className="animate-spin" />
              Applying...
            </>
          ) : (
            `Apply to ${eligibleCount}`
          )}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={
          isRejecting
            ? `Reject ${eligibleCount} ${applicationNoun(eligibleCount)}?`
            : `Set ${eligibleCount} ${applicationNoun(eligibleCount)} to ${statusLabel}?`
        }
        description={
          <div className="flex flex-col gap-2">
            <p>
              {eligibleCount} of {count} selected applications will change to{' '}
              {statusLabel}.
            </p>
            <p>Applicants see this status on their own application page.</p>
            {skippedLabel && (
              <p>{skippedLabel} will be skipped and stay as-is.</p>
            )}
          </div>
        }
        confirmLabel={
          isRejecting
            ? `Reject ${eligibleCount} ${applicationNoun(eligibleCount)}`
            : `Set to ${statusLabel}`
        }
        pendingLabel={isRejecting ? 'Rejecting…' : 'Updating…'}
        destructive={isRejecting}
        isPending={isPending}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
