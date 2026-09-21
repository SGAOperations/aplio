import Link from 'next/link';

import {
  getApplicationCompletion,
  getClosingSoonCount,
  getMyApplicationStatusCounts,
  getRecentMyApplications,
} from '@/prisma/data/applications';

import { APPLICATION_STATUS_LABELS } from '@/lib/constants';
import { CONCEPT_ICONS } from '@/lib/icons';
import {
  type ApplicationCompletion,
  type MyApplicationListItem,
} from '@/lib/types';

import { DeadlineIndicator } from '@/components/features/deadline-indicator';
import { ApplicationStatusBadge } from '@/components/features/status-badge';
import { LocalTime } from '@/components/ui/local-time';
import { ProgressRing } from '@/components/ui/progress-ring';
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
    getClosingSoonCount(userId, now),
  ]);

  const draftRows = applications.filter((a) => a.status === 'draft');
  const completion =
    draftRows.length > 0
      ? await getApplicationCompletion(
          draftRows.map((a) => ({
            id: a.id,
            positionId: a.positionId,
            userId,
          })),
        )
      : {};

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
        <ApplicationList
          applications={applications}
          now={now}
          completion={completion}
        />
      )}
    </SectionCard>
  );
}

function ApplicationList({
  applications,
  now,
  completion,
}: {
  applications: MyApplicationListItem[];
  now: Date;
  completion: Record<string, ApplicationCompletion>;
}) {
  return (
    <ul className="divide-y">
      {applications.map((app) => {
        const entry = app.status === 'draft' ? completion[app.id] : undefined;
        return (
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
            <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
              {app.status === 'draft' || app.status === 'withdrawn' ? (
                <>
                  <DeadlineIndicator
                    variant="compact"
                    position={app.position}
                    now={now}
                    emphasizeUrgency
                  />
                  {entry && <ProgressRing percent={entry.percent} size="sm" />}
                </>
              ) : app.submittedAt ? (
                <LocalTime date={app.submittedAt} precision="date" />
              ) : (
                '—'
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
