'use client';

import { useTransition } from 'react';

import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { updateApplicationStatuses } from '@/prisma/actions/applications';
import type { $Enums } from '@/prisma/client';

import { REVIEWER_APPLICATION_STATUS_OPTIONS } from '@/lib/constants';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ApplicationsBulkBarProps {
  selectedIds: string[];
  onApplied: () => void;
  status: $Enums.ApplicationStatus | '';
  onStatusChange: (value: $Enums.ApplicationStatus | '') => void;
}

export function ApplicationsBulkBar({
  selectedIds,
  onApplied,
  status,
  onStatusChange,
}: ApplicationsBulkBarProps) {
  const [isPending, startTransition] = useTransition();

  const count = selectedIds.length;
  const countLabel = count === 1 ? '1 selected' : `${count} selected`;

  function handleApply() {
    if (!status) return;
    startTransition(async () => {
      try {
        const result = await updateApplicationStatuses({
          applicationIds: selectedIds,
          status,
        });
        if ('error' in result) {
          toast.error(result.error);
        } else {
          const updated = result.updated;
          const label =
            updated === 1 ? '1 application' : `${updated} applications`;
          toast.success(`Updated ${label}`);
          onApplied();
        }
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });
  }

  return (
    <div className="bg-muted/50 flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <span className="text-sm font-medium">{countLabel}</span>

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

        <Button size="sm" onClick={handleApply} disabled={isPending || !status}>
          {isPending ? (
            <>
              <Loader2
                className="mr-1.5 h-3.5 w-3.5 animate-spin"
                aria-hidden
              />
              Applying...
            </>
          ) : (
            `Apply to ${count}`
          )}
        </Button>
      </div>
    </div>
  );
}
