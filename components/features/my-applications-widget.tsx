import Link from 'next/link';

import {
  getClosingSoonDraftCount,
  getMyApplicationStatusCounts,
  getRecentMyApplications,
} from '@/prisma/data/applications';

import { APPLICATION_STATUS_LABELS } from '@/lib/constants';
import { CONCEPT_ICONS } from '@/lib/icons';
import { type MyApplicationListItem } from '@/lib/types';

import { DeadlineIndicator } from '@/components/features/deadline-indicator';
import { ApplicationStatusBadge } from '@/components/features/status-badge';
import { LocalTime } from '@/components/ui/local-time';
import { SectionCard, SectionCardEmpty } from '@/components/ui/section-card';

interface MyApplicationsWidgetProps {
  userId: string;
  limit?: number;
}

function buildCountsSummary(
  counts: Partial<Record<string, number>>,
  closingSoonCount: number,
): string {
  // Drafts shown separately; skip zero counts.
  const draftCount = counts['draft'] ?? 0;
  const submittedParts: string[] = [];

  const statusOrder = ['applied', 'accepted', 'rejected'] as const;

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
  if (closingSoonCount > 0) parts.push(`${closingSoonCount} closing soon`);

  return parts.join(' · ');
}

export async function MyApplicationsWidget({
  userId,
  limit = 3,
}: MyApplicationsWidgetProps) {
  const now = new Date();
  const [applications, counts, closingSoonCount] = await Promise.all([
    getRecentMyApplications(userId, limit, now),
    getMyApplicationStatusCounts(userId),
    getClosingSoonDraftCount(userId, now),
  ]);

  const summary = buildCountsSummary(counts, closingSoonCount);

  return (
    <SectionCard
      title="My Applications"
      subtitle={summary || undefined}
      icon={CONCEPT_ICONS.myApplication}
      link={{
        href: '/applications',
        label: 'See all',
        ariaLabel: 'See all applications',
      }}
    >
      {applications.length === 0 ? (
        <SectionCardEmpty
          icon={CONCEPT_ICONS.myApplication}
          title="No applications yet"
          description="You haven't started any applications yet."
          action={
            <Link
              href="/positions"
              className="text-primary text-sm font-medium hover:underline"
            >
              Browse positions
            </Link>
          }
        />
      ) : (
        <ApplicationList applications={applications} now={now} />
      )}
    </SectionCard>
  );
}

function ApplicationList({
  applications,
  now,
}: {
  applications: MyApplicationListItem[];
  now: Date;
}) {
  return (
    <ul className="divide-y">
      {applications.map((app) => (
        <li
          key={app.id}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3"
        >
          <Link
            href={`/applications/${app.id}`}
            className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
          >
            {app.position.title}
          </Link>
          <span className="text-muted-foreground shrink-0 text-xs">
            {app.status === 'draft' ? (
              <DeadlineIndicator
                variant="compact"
                position={app.position}
                now={now}
                emphasizeUrgency
              />
            ) : (
              <LocalTime date={app.submittedAt} precision="date" />
            )}
          </span>
          <ApplicationStatusBadge status={app.status} />
        </li>
      ))}
    </ul>
  );
}
