import Link from 'next/link';
import { useId } from 'react';

import { type MyApplicationListItem } from '@/lib/types';
import { getApplicantActionBlockedReason } from '@/lib/utils';

import { Button } from '@/components/ui/button';

interface MyApplicationPrimaryActionProps {
  application: MyApplicationListItem;
}

// Draft continues the stepper; withdrawn resubmits through it too — both are
// the only applicant-editable statuses. Shared by the list row and the
// detail status card so the "route into editing" can't drift between them.
export function MyApplicationPrimaryAction({
  application,
}: MyApplicationPrimaryActionProps) {
  // Unconditional before the early return (rules of hooks) — needed for both row and mobile-card renders.
  const reasonId = useId();

  if (application.status !== 'draft' && application.status !== 'withdrawn')
    return null;

  const isDraft = application.status === 'draft';
  const label = isDraft ? 'Continue' : 'Edit & resubmit';
  const ariaLabel = isDraft
    ? `Continue application for ${application.position.title}`
    : `Edit and resubmit application for ${application.position.title}`;
  const reason = getApplicantActionBlockedReason(application.position);

  if (reason === null)
    return (
      <Button variant="outline" size="sm" asChild>
        <Link
          href={`/positions/${application.positionId}/apply`}
          aria-label={ariaLabel}
        >
          {label}
        </Link>
      </Button>
    );

  return (
    <span className="flex items-center gap-2">
      <span
        id={reasonId}
        className="text-muted-foreground text-sm whitespace-nowrap"
      >
        {reason}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-disabled="true"
        aria-label={ariaLabel}
        aria-describedby={reasonId}
        className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
      >
        {label}
      </Button>
    </span>
  );
}
