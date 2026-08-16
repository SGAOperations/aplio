'use client';

import { useId, useTransition } from 'react';

import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { updateApplicationStatus } from '@/prisma/actions/applications';
import { type $Enums } from '@/prisma/client';

import {
  APPLICATION_STATUS_LABELS,
  NON_REVIEWABLE_APPLICATION_STATUS_NOTES,
  REVIEWER_APPLICATION_STATUS_OPTIONS,
  isNonReviewableApplicationStatus,
} from '@/lib/constants';
import { cn } from '@/lib/utils';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ApplicationStatusControlProps {
  applicationId: string;
  currentStatus: $Enums.ApplicationStatus;
  labelText?: string;
  // Visually hides the label — kept in the a11y tree and still focuses the select on click.
  hideLabel?: boolean;
}

export function ApplicationStatusControl({
  applicationId,
  currentStatus,
  labelText = 'Status',
  hideLabel,
}: ApplicationStatusControlProps) {
  const [isPending, startTransition] = useTransition();
  const fieldId = useId();
  const noteId = useId();

  // Reviewer-selectable options — 'draft' is already excluded from this constant.
  const options = REVIEWER_APPLICATION_STATUS_OPTIONS;

  // Derived from the shared constant (not a hand-written check) so this can
  // never drift from the action's own non-reviewable guard.
  const isReadOnly = isNonReviewableApplicationStatus(currentStatus);

  function handleValueChange(value: string) {
    startTransition(async () => {
      try {
        const result = await updateApplicationStatus({
          applicationId,
          status: value,
        });
        if (result && 'error' in result) {
          toast.error(result.error);
        } else {
          toast.success('Status updated');
        }
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={fieldId} className={cn(hideLabel && 'sr-only')}>
        {labelText}
      </Label>
      <div className="flex items-center gap-3">
        {isPending && (
          <Loader2
            className="text-muted-foreground h-4 w-4 animate-spin"
            aria-hidden
          />
        )}
        <Select
          value={isReadOnly ? undefined : currentStatus}
          onValueChange={handleValueChange}
          disabled={isPending || isReadOnly}
        >
          <SelectTrigger
            id={fieldId}
            className="w-52"
            aria-describedby={isReadOnly ? noteId : undefined}
          >
            <SelectValue
              placeholder={
                isReadOnly
                  ? APPLICATION_STATUS_LABELS[currentStatus]
                  : undefined
              }
            />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {isReadOnly && (
        <p id={noteId} className="text-muted-foreground text-xs">
          {NON_REVIEWABLE_APPLICATION_STATUS_NOTES[currentStatus]}
        </p>
      )}
    </div>
  );
}
