import { Activity } from 'lucide-react';

import {
  getMyRecentActivity,
  getRecentApplications,
} from '@/prisma/data/applications';

import {
  APPLICATION_STATUS_BADGE_VARIANT,
  APPLICATION_STATUS_LABELS,
  STATUS_BADGE_VARIANT_TO_DOT,
} from '@/lib/constants';
import { type ActivityItem, type Reviewer } from '@/lib/types';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LocalTime } from '@/components/ui/local-time';

// ─── Presentational leaf ─────────────────────────────────────────────────────

interface ActivityFeedListProps {
  items: ActivityItem[];
  emptyDescription: string;
}

function ActivityFeedList({ items, emptyDescription }: ActivityFeedListProps) {
  return (
    <section aria-label="Recent activity">
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
              <p className="text-muted-foreground text-sm">
                {emptyDescription}
              </p>
            </div>
          ) : (
            <ol>
              {items.map((item) => {
                const dotClass =
                  STATUS_BADGE_VARIANT_TO_DOT[item.statusVariant] ??
                  'bg-muted-foreground';

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
                    <LocalTime
                      date={item.timestamp}
                      precision="relative"
                      className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums"
                    />
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

// ─── Applicant feed wrapper ───────────────────────────────────────────────────

interface ApplicantActivityFeedProps {
  userId: string;
}

// States the current status only — no status-history table, so no from-state to assert.
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

// ─── Reviewer feed wrapper ─────────────────────────────────────────────────────

interface ReviewerActivityFeedProps {
  reviewer: Reviewer;
}

// Ordered by submittedAt (a provable event stream); cross-user data, reviewer-gated only.
export async function ReviewerActivityFeed({
  reviewer,
}: ReviewerActivityFeedProps) {
  const applications = await getRecentApplications(reviewer, 10);

  const items: ActivityItem[] = applications.map((app) => {
    const applicantLabel = app.applicantName ?? app.user.name ?? app.user.email;
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
      emptyDescription={
        reviewer.isAdmin
          ? 'New applications across all positions will show up here.'
          : 'New applications to the positions you manage will show up here.'
      }
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
        {Array.from({ length: 10 }).map((_, i) => (
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
