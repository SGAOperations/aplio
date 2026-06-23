'use client';

import { useState, useTransition } from 'react';

import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { updateApplicationStatus } from '@/prisma/actions/applications';
import type { $Enums } from '@/prisma/client';

import {
  APPLICATION_STATUS_LABELS,
  MANAGEABLE_APPLICATION_STATUSES,
} from '@/lib/constants';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ManageableStatus = (typeof MANAGEABLE_APPLICATION_STATUSES)[number];

interface ApplicationStatusSelectProps {
  applicationId: string;
  currentStatus: $Enums.ApplicationStatus;
  applicantName: string;
}

export function ApplicationStatusSelect({
  applicationId,
  currentStatus,
  applicantName,
}: ApplicationStatusSelectProps) {
  const [isPending, startTransition] = useTransition();
  // Controlled from local state so we can revert on failure.
  const [value, setValue] = useState<ManageableStatus>(
    currentStatus as ManageableStatus,
  );

  function handleChange(next: string) {
    const nextStatus = next as ManageableStatus;
    const previous = value;
    setValue(nextStatus);
    startTransition(async () => {
      try {
        await updateApplicationStatus({ applicationId, status: nextStatus });
        toast.success(
          `Status updated to ${APPLICATION_STATUS_LABELS[nextStatus]}`,
        );
      } catch {
        setValue(previous);
        toast.error('Something went wrong');
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={value} onValueChange={handleChange} disabled={isPending}>
        <SelectTrigger
          className="w-[180px]"
          aria-label={`Status for ${applicantName}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MANAGEABLE_APPLICATION_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {APPLICATION_STATUS_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isPending && (
        <Loader2
          className="text-muted-foreground size-4 animate-spin"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
