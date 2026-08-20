import Link from 'next/link';

import { Inbox } from 'lucide-react';

import { getRecentApplications } from '@/prisma/data/applications';

import { type AdminApplicationListItem, type Reviewer } from '@/lib/types';
import { getRenamedTo } from '@/lib/utils';

import { ApplicationStatusBadge } from '@/components/features/status-badge';
import { LocalTime } from '@/components/ui/local-time';
import { SectionCard, SectionCardEmpty } from '@/components/ui/section-card';

interface RecentApplicationsProps {
  reviewer: Reviewer;
  limit?: number;
}

export async function RecentApplications({
  reviewer,
  limit = 3,
}: RecentApplicationsProps) {
  const applications = await getRecentApplications(reviewer, limit);

  return (
    <SectionCard
      title="Recent Applications"
      link={{
        href: '/applications',
        label: 'See all',
        ariaLabel: 'See all applications',
      }}
    >
      {applications.length === 0 ? (
        <SectionCardEmpty
          icon={Inbox}
          title="No applications yet"
          description={
            reviewer.isAdmin
              ? 'Submissions across all positions will appear here.'
              : 'Submissions to the positions you manage will appear here.'
          }
        />
      ) : (
        <ApplicationList applications={applications} />
      )}
    </SectionCard>
  );
}

function ApplicationList({
  applications,
}: {
  applications: AdminApplicationListItem[];
}) {
  return (
    <ul className="divide-y">
      {applications.map((app) => {
        const applicantLabel =
          app.applicantName ?? app.user.name ?? app.user.email;
        const renamedTo = getRenamedTo(app);
        return (
          <li
            key={app.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3"
          >
            <Link
              href={`/applications/${app.id}`}
              className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
            >
              {applicantLabel}
              {renamedTo && (
                <span className="text-muted-foreground ml-1 text-xs">
                  ({renamedTo})
                </span>
              )}
            </Link>
            <span className="text-muted-foreground shrink-0 text-xs">
              {app.position.title}
            </span>
            <ApplicationStatusBadge status={app.status} />
            <span className="text-muted-foreground shrink-0 text-xs">
              <LocalTime date={app.submittedAt} precision="date" />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
