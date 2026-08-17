import { type $Enums } from '@/prisma/client';

import { TERMINAL_DECISION_STATUSES } from '@/lib/constants';
import { type MyApplicationDetail } from '@/lib/types';

import { MyApplicationPrimaryAction } from '@/components/features/my-application-primary-action';
import { MyApplicationRowActions } from '@/components/features/my-application-row-actions';
import { ApplicationStatusBadge } from '@/components/features/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Exhaustive on the generated enum, so a new status breaks the build here too.
const STATUS_COPY: Record<$Enums.ApplicationStatus, string> = {
  draft: "You haven't submitted this application yet.",
  applied: "Submitted. We'll update you here as it moves through review.",
  reached_out: 'The team has reached out to you about this application.',
  interview_scheduled: 'An interview has been scheduled for this application.',
  reviewing: 'Your application is being reviewed.',
  accepted: "You've been accepted for this position.",
  rejected: "This application wasn't selected.",
  withdrawn:
    'You withdrew this application. You can edit and resubmit it to put it back in the queue.',
};

interface MyApplicationStatusCardProps {
  application: MyApplicationDetail;
}

export function MyApplicationStatusCard({
  application,
}: MyApplicationStatusCardProps) {
  return (
    <Card>
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-base font-semibold">Status</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-3 pt-0">
        <ApplicationStatusBadge status={application.status} />
        <p className="text-muted-foreground text-sm">
          {STATUS_COPY[application.status]}
        </p>
        {/* Terminal statuses have no action — no dash placeholder either */}
        {!TERMINAL_DECISION_STATUSES.includes(application.status) && (
          <div className="flex items-center gap-2">
            <MyApplicationPrimaryAction application={application} />
            <MyApplicationRowActions
              applicationId={application.id}
              status={application.status}
              positionTitle={application.position.title}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
