import {
  getMyRecentActivity,
  getRecentApplications,
} from '@/prisma/data/applications';

import {
  APPLICATION_STATUS_BADGE_VARIANT,
  APPLICATION_STATUS_LABELS,
  STATUS_BADGE_VARIANT_TO_DOT,
} from '@/lib/constants';
import { CONCEPT_ICONS } from '@/lib/icons';
import { type ActivityItem, type Reviewer } from '@/lib/types';
import { getRenamedTo } from '@/lib/utils';

import { LocalTime } from '@/components/ui/local-time';
import { SectionCard, SectionCardEmpty } from '@/components/ui/section-card';

// ─── Presentational leaf ─────────────────────────────────────────────────────

interface ActivityFeedListProps {
  items: ActivityItem[];
  emptyDescription: string;
}

function ActivityFeedList({ items, emptyDescription }: ActivityFeedListProps) {
  return (
    <SectionCard
      title="Recent activity"
      icon={CONCEPT_ICONS.activity}
      sectionLabel="Recent activity"
    >
      {items.length === 0 ? (
        <SectionCardEmpty
          icon={CONCEPT_ICONS.activity}
          title="No recent activity"
          description={emptyDescription}
        />
      ) : (
        <ol>
          {items.map((item) => {
            const dotClass = STATUS_BADGE_VARIANT_TO_DOT[item.statusVariant];

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
    </SectionCard>
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
    const renamedTo = getRenamedTo(app);
    const variant = APPLICATION_STATUS_BADGE_VARIANT[app.status];
    return {
      id: app.id,
      statusVariant: variant,
      sentence: `${applicantLabel}${renamedTo ? ` (${renamedTo})` : ''} applied for ${app.position.title}`,
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
