import Link from 'next/link';

import { type MyApplicationListItem } from '@/lib/types';
import { getApplicantActionBlockedReason } from '@/lib/utils';

import { DisabledActionTooltip } from '@/components/features/disabled-action-tooltip';
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
    <DisabledActionTooltip reason={reason}>
      {(describedBy) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-disabled="true"
          aria-label={ariaLabel}
          aria-describedby={describedBy}
          className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
        >
          {label}
        </Button>
      )}
    </DisabledActionTooltip>
  );
}
