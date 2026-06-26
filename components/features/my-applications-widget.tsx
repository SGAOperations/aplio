import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import {
  getMyApplicationStatusCounts,
  getRecentMyApplications,
} from '@/prisma/data/applications';

import { APPLICATION_STATUS_LABELS } from '@/lib/constants';
import { type MyApplicationListItem } from '@/lib/types';
import { formatDate } from '@/lib/utils';

import { ApplicationStatusBadge } from '@/components/features/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MyApplicationsWidgetProps {
  userId: string;
  limit?: number;
}

function buildCountsSummary(counts: Partial<Record<string, number>>): string {
  // Drafts shown separately; skip zero counts.
  const draftCount = counts['draft'] ?? 0;
  const submittedParts: string[] = [];

  const statusOrder = [
    'applied',
    'reached_out',
    'interview_scheduled',
    'reviewing',
    'accepted',
    'rejected',
  ] as const;

  for (const status of statusOrder) {
    const count = counts[status];
    if (count && count > 0)
      submittedParts.push(
        `${count} ${APPLICATION_STATUS_LABELS[status].toLowerCase()}`,
      );
  }

  const parts: string[] = [];
  if (submittedParts.length > 0) parts.push(...submittedParts);
  if (draftCount > 0)
    parts.push(`${draftCount} ${draftCount === 1 ? 'draft' : 'drafts'}`);

  return parts.join(' · ');
}

export async function MyApplicationsWidget({
  userId,
  limit = 3,
}: MyApplicationsWidgetProps) {
  const [applications, counts] = await Promise.all([
    getRecentMyApplications(userId, limit),
    getMyApplicationStatusCounts(userId),
  ]);

  const summary = buildCountsSummary(counts);

  return (
    // overflow-hidden clips the header hover highlight to the card's rounded corners
    <Card className="gap-0 overflow-hidden p-0">
      <CardHeader className="border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">
              My Applications
            </CardTitle>
            {summary && (
              <p className="text-muted-foreground mt-1 text-sm">{summary}</p>
            )}
          </div>
          <Link
            href="/my-applications"
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
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-muted-foreground text-sm">
              You haven&apos;t started any applications yet.
            </p>
            <Link
              href="/positions"
              className="text-primary text-sm font-medium hover:underline"
            >
              Browse positions
            </Link>
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
  applications: MyApplicationListItem[];
}) {
  return (
    <ul className="divide-y">
      {applications.map((app) => (
        <li
          key={app.id}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3"
        >
          <Link
            href={`/positions/${app.positionId}`}
            className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
          >
            {app.position.title}
          </Link>
          <ApplicationStatusBadge status={app.status} />
          <span className="text-muted-foreground shrink-0 text-xs">
            {app.status === 'draft' ? '—' : formatDate(app.submittedAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}
