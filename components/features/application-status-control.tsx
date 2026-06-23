'use client';

import { useTransition } from 'react';

import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { updateApplicationStatus } from '@/prisma/actions/applications';
import { type $Enums } from '@/prisma/client';

import { REVIEWER_APPLICATION_STATUS_OPTIONS } from '@/lib/constants';

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
}

export function ApplicationStatusControl({
  applicationId,
  currentStatus,
}: ApplicationStatusControlProps) {
  const [isPending, startTransition] = useTransition();

  const isDraft = currentStatus === 'draft';

  // Reviewer-selectable options — 'draft' is already excluded from this constant.
  const options = REVIEWER_APPLICATION_STATUS_OPTIONS;

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
      <Label htmlFor="application-status">Status</Label>
      <div className="flex items-center gap-3">
        {isPending && (
          <Loader2
            className="text-muted-foreground h-4 w-4 animate-spin"
            aria-hidden
          />
        )}
        <Select
          value={isDraft ? undefined : currentStatus}
          onValueChange={handleValueChange}
          disabled={isPending || isDraft}
        >
          <SelectTrigger id="application-status" className="w-52">
            <SelectValue placeholder={isDraft ? 'Draft' : undefined} />
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
      {isDraft && (
        <p className="text-muted-foreground text-sm">
          This application has not been submitted yet.
        </p>
      )}
    </div>
  );
}
