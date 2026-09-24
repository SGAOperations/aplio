import { getActivityGroups } from '@/prisma/data/activity';

import {
  ACTIVITY_FEED_COPY,
  ACTIVITY_MINE_TITLE,
  STATUS_BADGE_VARIANT_TO_DOT,
} from '@/lib/constants';
import { CONCEPT_ICONS } from '@/lib/icons';
import { type ActivityItem } from '@/lib/types';

import { LocalTime } from '@/components/ui/local-time';
import { SectionCardEmpty } from '@/components/ui/section-card';
import { Skeleton } from '@/components/ui/skeleton';

export function ActivityFeedList({ items }: { items: ActivityItem[] }) {
  return (
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
  );
}

function ActivityFeedGroup({
  id,
  title,
  items,
}: {
  id: string;
  title: string;
  items: ActivityItem[];
}) {
  return (
    <section aria-labelledby={id}>
      <h3
        id={id}
        className="text-muted-foreground px-4 pt-4 pb-1 text-xs font-medium"
      >
        {title}
      </h3>
      <ActivityFeedList items={items} />
    </section>
  );
}

interface ActivityFeedProps {
  userId: string;
  isAdmin: boolean;
}

export async function ActivityFeed({ userId, isAdmin }: ActivityFeedProps) {
  const { scope, mine, reviewed } = await getActivityGroups(userId, isAdmin);
  const copy = ACTIVITY_FEED_COPY[scope];

  if (mine.length === 0 && reviewed.length === 0)
    return (
      <SectionCardEmpty
        icon={CONCEPT_ICONS.activity}
        title="No recent activity"
        description={copy.emptyDescription}
      />
    );

  if (scope === 'none') return <ActivityFeedList items={mine} />;

  return (
    <>
      {mine.length > 0 && (
        <ActivityFeedGroup
          id="activity-mine"
          title={ACTIVITY_MINE_TITLE}
          items={mine}
        />
      )}
      {reviewed.length > 0 && copy.reviewedTitle && (
        <ActivityFeedGroup
          id="activity-reviewed"
          title={copy.reviewedTitle}
          items={reviewed}
        />
      )}
    </>
  );
}

export function ActivityFeedListSkeleton() {
  return (
    <ol>
      {Array.from({ length: 10 }).map((_, i) => (
        <li
          key={i}
          className="flex items-center gap-3 border-b px-4 py-3 last:border-0"
        >
          <Skeleton className="size-2 shrink-0 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-3 w-12" />
        </li>
      ))}
    </ol>
  );
}
