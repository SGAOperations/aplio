import Link from 'next/link';

import { FileStack } from 'lucide-react';

import { getApplicantOtherApplications } from '@/prisma/data/applications';

import { type ApplicantOtherApplication, type Reviewer } from '@/lib/types';

import { ApplicationStatusBadge } from '@/components/features/status-badge';
import { LocalTime } from '@/components/ui/local-time';
import { SectionCard, SectionCardEmpty } from '@/components/ui/section-card';

interface ApplicantOtherApplicationsProps {
  applicationId: string;
  user: Reviewer;
}

export async function ApplicantOtherApplications({
  applicationId,
  user,
}: ApplicantOtherApplicationsProps) {
  const applications = await getApplicantOtherApplications(applicationId, user);

  return (
    <SectionCard
      title="Other applications"
      titleAs="h2"
      subtitle="All other positions this applicant has applied to."
    >
      {applications.length === 0 ? (
        <SectionCardEmpty
          icon={FileStack}
          title="No other applications"
          description="This is the only position this applicant has applied to recently."
        />
      ) : (
        <OtherApplicationList applications={applications} />
      )}
    </SectionCard>
  );
}

function OtherApplicationList({
  applications,
}: {
  applications: ApplicantOtherApplication[];
}) {
  return (
    <ul className="divide-y">
      {applications.map((app) => (
        <li
          key={app.id}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3"
        >
          <Link
            href={`/positions/${app.position.id}`}
            className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
          >
            {app.position.title}
          </Link>
          <ApplicationStatusBadge status={app.status} />
          <span className="text-muted-foreground shrink-0 text-xs">
            <LocalTime date={app.submittedAt} precision="date" />
          </span>
          {app.canOpen && (
            <Link
              href={`/applications/${app.id}`}
              aria-label={`View ${app.position.title} application`}
              className="shrink-0 text-sm font-medium hover:underline"
            >
              View
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
