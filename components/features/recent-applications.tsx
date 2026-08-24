import Link from 'next/link';

import { getRecentApplications } from '@/prisma/data/applications';

import { CONCEPT_ICONS } from '@/lib/icons';
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
      icon={CONCEPT_ICONS.application}
      link={{
        href: '/applications',
        label: 'See all',
        ariaLabel: 'See all applications',
      }}
    >
      {applications.length === 0 ? (
        <SectionCardEmpty
          icon={CONCEPT_ICONS.application}
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
            {/* order-* keeps one DOM order for both the stacked mobile layout and the single desktop line */}
            <Link
              href={`/applications/${app.id}`}
              className="order-1 flex min-h-11 min-w-0 flex-1 items-center hover:underline md:min-h-0"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {applicantLabel}
                {renamedTo && (
                  <span className="text-muted-foreground ml-1 text-xs">
                    ({renamedTo})
                  </span>
                )}
              </span>
            </Link>
            <span className="order-2 shrink-0 md:order-3">
              <ApplicationStatusBadge status={app.status} />
            </span>
            <span className="text-muted-foreground order-3 w-full truncate text-xs md:order-2 md:w-auto md:shrink-0">
              {app.position.title}
            </span>
            <span className="text-muted-foreground order-4 hidden shrink-0 text-xs md:inline">
              <LocalTime date={app.submittedAt} precision="date" />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
