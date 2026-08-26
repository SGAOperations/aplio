import Link from 'next/link';

import { type MyApplicationListItem } from '@/lib/types';
import { isAcceptingApplications } from '@/lib/utils';

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
  if (application.deletedAt) return null;

  if (application.status === 'draft')
    return (
      <Button variant="outline" size="sm" asChild>
        <Link href={`/positions/${application.positionId}/apply`}>
          Continue
        </Link>
      </Button>
    );

  if (application.status !== 'withdrawn') return null;

  if (!isAcceptingApplications(application.position))
    return (
      <span className="text-muted-foreground text-sm">Position closed</span>
    );

  return (
    <Button variant="outline" size="sm" asChild>
      <Link
        href={`/positions/${application.positionId}/apply`}
        aria-label={`Edit and resubmit application for ${application.position.title}`}
      >
        Edit &amp; resubmit
      </Link>
    </Button>
  );
}
