import Link from 'next/link';

import {
  getMyApplicationStatusCounts,
  getRecentMyApplications,
} from '@/prisma/data/applications';

import { APPLICATION_STATUS_LABELS } from '@/lib/constants';
import { CONCEPT_ICONS } from '@/lib/icons';
import { type MyApplicationListItem } from '@/lib/types';

import { ApplicationStatusBadge } from '@/components/features/status-badge';
import { LocalTime } from '@/components/ui/local-time';
import { SectionCard, SectionCardEmpty } from '@/components/ui/section-card';

interface MyApplicationsWidgetProps {
  userId: string;
  limit?: number;
}

function buildCountsSummary(counts: Partial<Record<string, number>>): string {
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
        <ApplicationList applications={applications} />
      )}
    </SectionCard>
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
            href={`/applications/${app.id}`}
            className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
          >
            {app.position.title}
          </Link>
          <ApplicationStatusBadge status={app.status} />
          <span className="text-muted-foreground shrink-0 text-xs">
            {app.status === 'draft' ? (
              '—'
            ) : (
              <LocalTime date={app.submittedAt} precision="date" />
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
