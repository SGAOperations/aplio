import { Activity } from 'lucide-react';

import { getMyRecentActivity } from '@/prisma/data/applications';
import { getRecentApplications } from '@/prisma/data/applications';

import {
  APPLICATION_STATUS_BADGE_VARIANT,
  APPLICATION_STATUS_LABELS,
  STATUS_BADGE_VARIANT_TO_DOT,
} from '@/lib/constants';
import { type ActivityItem } from '@/lib/types';
import { formatRelativeTime } from '@/lib/utils';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ─── Presentational leaf ─────────────────────────────────────────────────────

interface ActivityFeedListProps {
  items: ActivityItem[];
  emptyDescription: string;
}

function ActivityFeedList({ items, emptyDescription }: ActivityFeedListProps) {
  return (
    <Card className="gap-0 p-0">
      <CardHeader className="border-b p-4">
        <CardTitle className="text-base font-semibold">
          Recent activity
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Activity
              className="text-muted-foreground size-10"
              aria-hidden="true"
            />
            <p className="text-sm font-medium">No recent activity</p>
            <p className="text-muted-foreground text-sm">{emptyDescription}</p>
          </div>
        ) : (
          <ol>
            {items.map((item) => {
              const dotClass =
                STATUS_BADGE_VARIANT_TO_DOT[item.statusVariant] ??
                'bg-muted-foreground';
              const isoString = item.timestamp.toISOString();
              const relativeTime = formatRelativeTime(item.timestamp);

              return (
                <li
                  key={item.id}
                  className="flex items-start gap-3 border-b px-4 py-3 last:border-0"
                >
                  <span
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${dotClass}`}
                    aria-hidden="true"
                  />
                  <p className="line-clamp-2 min-w-0 flex-1 text-sm">
                    {item.sentence}
                  </p>
                  <time
                    dateTime={isoString}
                    className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums"
                  >
                    {relativeTime}
                  </time>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Applicant feed wrapper ───────────────────────────────────────────────────

interface ApplicantActivityFeedProps {
  userId: string;
}

// Feed shows applicant's own non-draft applications ordered by updatedAt DESC.
// Copy describes current state ("is {Status}") — avoids asserting a from-state
// we cannot prove (no status-history table; see issue §0).
export async function ApplicantActivityFeed({
  userId,
}: ApplicantActivityFeedProps) {
  const applications = await getMyRecentActivity(userId, 10);

  const items: ActivityItem[] = applications.map((app) => {
    const statusLabel = APPLICATION_STATUS_LABELS[app.status];
    const variant = APPLICATION_STATUS_BADGE_VARIANT[app.status];
    return {
      id: app.id,
      statusVariant: variant,
      sentence: `Your application for ${app.position.title} is ${statusLabel}`,
      timestamp: app.updatedAt,
    };
  });

  return (
    <ActivityFeedList
      items={items}
      emptyDescription="Updates to your applications will show up here."
    />
  );
}

// ─── Admin feed wrapper ───────────────────────────────────────────────────────

// Feed shows most recent non-draft applications across all positions, ordered
// by submittedAt DESC — a provable "applied" event stream (unlike updatedAt).
// Returns cross-user data — must only be called from an admin-gated context.
export async function AdminActivityFeed() {
  const applications = await getRecentApplications(10);

  const items: ActivityItem[] = applications.map((app) => {
    const applicantLabel = app.user.name ?? app.user.email;
    const variant = APPLICATION_STATUS_BADGE_VARIANT[app.status];
    return {
      id: app.id,
      statusVariant: variant,
      sentence: `${applicantLabel} applied for ${app.position.title}`,
      timestamp: app.submittedAt,
    };
  });

  return (
    <ActivityFeedList
      items={items}
      emptyDescription="New applications across all positions will show up here."
    />
  );
}

// ─── Shared skeleton ─────────────────────────────────────────────────────────

export function ActivityFeedSkeleton() {
  return (
    <Card className="gap-0 p-0">
      <CardHeader className="border-b p-4">
        <div className="bg-muted h-5 w-32 animate-pulse rounded" />
      </CardHeader>
      <CardContent className="p-0">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b px-4 py-3 last:border-0"
          >
            <div className="bg-muted size-2 shrink-0 animate-pulse rounded-full" />
            <div className="bg-muted h-4 flex-1 animate-pulse rounded" />
            <div className="bg-muted h-3 w-12 animate-pulse rounded" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
