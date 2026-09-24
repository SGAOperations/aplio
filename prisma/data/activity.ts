import 'server-only';

import { cache } from 'react';

import {
  getMyRecentActivity,
  getRecentApplications,
} from '@/prisma/data/applications';
import { isManager } from '@/prisma/data/managers';
import {
  getRecentPositionDeadlineCloses,
  getRecentPositionStatusEvents,
} from '@/prisma/data/positions';

import {
  APPLICATION_STATUS_BADGE_VARIANT,
  APPLICATION_STATUS_LABELS,
  POSITION_ACTIVITY_SENTENCE,
  POSITION_CLOSED_BY_DATE_SENTENCE,
  POSITION_CLOSED_SENTENCE,
  POSITION_STATUS_BADGE_VARIANT,
} from '@/lib/constants';
import { type ActivityGroups, type ActivityItem } from '@/lib/types';
import { getDisplayName, getRenamedTo } from '@/lib/utils';

const ACTIVITY_TAKE = 10;

// Deduped across the sidebar's and mobile nav's header instances by cache().
export const getActivityGroups = cache(async function getActivityGroups(
  userId: string,
  isAdmin: boolean,
): Promise<ActivityGroups> {
  const scope = isAdmin
    ? 'all'
    : (await isManager(userId))
      ? 'managed'
      : 'none';

  const [applications, reviewed, statusEvents, deadlineCloses] =
    await Promise.all([
      getMyRecentActivity(userId, ACTIVITY_TAKE),
      scope !== 'none'
        ? getRecentApplications({ id: userId, isAdmin }, ACTIVITY_TAKE)
        : Promise.resolve([]),
      scope !== 'none'
        ? getRecentPositionStatusEvents({ id: userId, isAdmin }, ACTIVITY_TAKE)
        : Promise.resolve([]),
      scope !== 'none'
        ? getRecentPositionDeadlineCloses(
            { id: userId, isAdmin },
            ACTIVITY_TAKE,
          )
        : Promise.resolve([]),
    ]);

  const mine: ActivityItem[] = applications.map((app) => {
    const statusLabel = APPLICATION_STATUS_LABELS[app.status];
    const variant = APPLICATION_STATUS_BADGE_VARIANT[app.status];
    return {
      id: app.id,
      statusVariant: variant,
      sentence: `Your application for ${app.position.title} is ${statusLabel}`,
      timestamp: app.submittedAt,
    };
  });

  const applicationItems: ActivityItem[] = reviewed
    .filter((app) => app.user.id !== userId)
    .map((app) => {
      const applicantLabel = getDisplayName(app);
      const renamedTo = getRenamedTo(app);
      const variant = APPLICATION_STATUS_BADGE_VARIANT[app.status];
      return {
        id: app.id,
        statusVariant: variant,
        sentence: `${applicantLabel}${renamedTo ? ` (${renamedTo})` : ''} applied for ${app.position.title}`,
        timestamp: app.submittedAt,
      };
    });

  // to: 'open' means from can never be 'open' — narrow with a guard, not a cast.
  const openingItems: ActivityItem[] = statusEvents
    .filter(
      (
        event,
      ): event is typeof event & { to: 'open'; from: 'draft' | 'closed' } =>
        event.to === 'open',
    )
    .map((event) => ({
      id: event.id,
      statusVariant: POSITION_STATUS_BADGE_VARIANT.open,
      sentence: POSITION_ACTIVITY_SENTENCE[event.from](event.position.title),
      timestamp: event.createdAt,
      href: `/positions/${event.position.id}`,
    }));

  const closedItems: ActivityItem[] = statusEvents
    .filter((event) => event.to === 'closed')
    .map((event) => ({
      id: event.id,
      statusVariant: POSITION_STATUS_BADGE_VARIANT.closed,
      sentence: POSITION_CLOSED_SENTENCE(event.position.title),
      timestamp: event.createdAt,
      href: `/positions/${event.position.id}`,
    }));

  // closesAt is guaranteed non-null by the query's where — narrow, not cast.
  const deadlineCloseItems: ActivityItem[] = deadlineCloses
    .filter(
      (position): position is typeof position & { closesAt: Date } =>
        position.closesAt !== null,
    )
    .map((position) => ({
      id: `deadline-close-${position.id}`,
      statusVariant: POSITION_STATUS_BADGE_VARIANT.closed,
      sentence: POSITION_CLOSED_BY_DATE_SENTENCE(position.title),
      timestamp: position.closesAt,
      href: `/positions/${position.id}`,
    }));

  const reviewedItems = [
    ...applicationItems,
    ...openingItems,
    ...closedItems,
    ...deadlineCloseItems,
  ]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, ACTIVITY_TAKE);

  return { scope, mine, reviewed: reviewedItems };
});
