import Link from 'next/link';

import { ArrowRight, Inbox } from 'lucide-react';

import { getRecentApplications } from '@/prisma/data/applications';

import { type AdminApplicationListItem } from '@/lib/types';
import { formatDate } from '@/lib/utils';

import { ApplicationStatusBadge } from '@/components/features/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RecentApplicationsProps {
  limit?: number;
}

export async function RecentApplications({
  limit = 3,
}: RecentApplicationsProps) {
  const applications = await getRecentApplications(limit);

  return (
    // overflow-hidden clips the header hover highlight to the card's rounded corners
    <Card className="gap-0 overflow-hidden p-0">
      <CardHeader className="border-b p-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Recent Applications
          </CardTitle>
          <Link
            href="/applications"
            aria-label="See all applications"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
          >
            See all
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {applications.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Inbox
              className="text-muted-foreground size-10"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium">No applications yet</p>
              <p className="text-muted-foreground mt-0.5 text-sm">
                Submissions across all positions will appear here.
              </p>
            </div>
          </div>
        ) : (
          <ApplicationList applications={applications} />
        )}
      </CardContent>
    </Card>
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
        const applicantLabel = app.user.name ?? app.user.email;
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
            </Link>
            <span className="text-muted-foreground hidden shrink-0 text-xs sm:inline">
              {app.position.title}
            </span>
            <ApplicationStatusBadge status={app.status} />
            <span className="text-muted-foreground shrink-0 text-xs">
              {formatDate(app.submittedAt)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
