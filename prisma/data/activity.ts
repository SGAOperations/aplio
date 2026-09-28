import 'server-only';

import { cache } from 'react';

import {
  getMyRecentActivity,
  getRecentApplications,
} from '@/prisma/data/applications';
import { isManager } from '@/prisma/data/managers';
import {
  getRecentPositionDeadlineCloses,
  getRecentPositionDeletions,
  getRecentPositionStatusEvents,
} from '@/prisma/data/positions';

import {
  ACTIVITY_MAX_ITEMS,
  APPLICATION_STATUS_BADGE_VARIANT,
  APPLICATION_STATUS_LABELS,
  POSITION_ACTIVITY_SENTENCE,
  POSITION_CLOSED_BY_DATE_SENTENCE,
  POSITION_CLOSED_SENTENCE,
  POSITION_DELETED_BADGE_VARIANT,
  POSITION_DELETED_SENTENCE,
  POSITION_STATUS_BADGE_VARIANT,
} from '@/lib/constants';
import { type ActivityGroups, type ActivityItem } from '@/lib/types';
import { getDisplayName, getRenamedTo, limitActivityItems } from '@/lib/utils';

// Deduped across the sidebar's and mobile nav's header instances by cache().
export const getActivityGroups = cache(async function getActivityGroups(
  userId: string,
  isAdmin: boolean,
): Promise<ActivityGroups> {
  const now = new Date();

  // Fetched unconditionally: deleting a manager's only position drops it from
  // isManager's non-deleted count, so this alone must still unlock 'managed'.
  const [applications, isUserManager, deletions] = await Promise.all([
    getMyRecentActivity(userId, ACTIVITY_MAX_ITEMS),
    isAdmin ? Promise.resolve(true) : isManager(userId),
    getRecentPositionDeletions({ id: userId, isAdmin }, ACTIVITY_MAX_ITEMS),
  ]);

  const scope = isAdmin
    ? 'all'
    : isUserManager || deletions.length > 0
      ? 'managed'
      : 'none';

  const [reviewed, statusEvents, deadlineCloses] = await Promise.all([
    scope !== 'none'
      ? getRecentApplications({ id: userId, isAdmin }, ACTIVITY_MAX_ITEMS)
      : Promise.resolve([]),
    scope !== 'none'
      ? getRecentPositionStatusEvents(
          { id: userId, isAdmin },
          ACTIVITY_MAX_ITEMS,
        )
      : Promise.resolve([]),
    scope !== 'none'
      ? getRecentPositionDeadlineCloses(
          { id: userId, isAdmin },
          ACTIVITY_MAX_ITEMS,
        )
      : Promise.resolve([]),
  ]);

  const mineItems: ActivityItem[] = applications.map((app) => {
    const statusLabel = APPLICATION_STATUS_LABELS[app.status];
    const variant = APPLICATION_STATUS_BADGE_VARIANT[app.status];
    return {
      id: app.id,
      statusVariant: variant,
      sentence: `Your application for ${app.position.title} is ${statusLabel}`,
      timestamp: app.statusChangedAt,
      href: `/applications/${app.id}`,
    };
  });

  const mine = limitActivityItems(mineItems, now);

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
        href: `/manage/applications/${app.id}`,
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

  // deletedAt is guaranteed non-null by the query's where — narrow, not cast.
  const deletionItems: ActivityItem[] = deletions
    .filter(
      (position): position is typeof position & { deletedAt: Date } =>
        position.deletedAt !== null,
    )
    .map((position) => ({
      id: `deletion-${position.id}`,
      statusVariant: POSITION_DELETED_BADGE_VARIANT,
      sentence: POSITION_DELETED_SENTENCE(position.title),
      timestamp: position.deletedAt,
      href: `/positions/${position.id}`,
    }));

  const sorted = [
    ...applicationItems,
    ...openingItems,
    ...closedItems,
    ...deadlineCloseItems,
    ...deletionItems,
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const reviewedItems = limitActivityItems(sorted, now);

  return { scope, mine, reviewed: reviewedItems };
});
