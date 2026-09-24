import 'server-only';

import { cache } from 'react';

import {
  getMyRecentActivity,
  getRecentApplications,
} from '@/prisma/data/applications';
import { isManager } from '@/prisma/data/managers';

import {
  APPLICATION_STATUS_BADGE_VARIANT,
  APPLICATION_STATUS_LABELS,
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

  const [applications, reviewed] = await Promise.all([
    getMyRecentActivity(userId, ACTIVITY_TAKE),
    scope !== 'none'
      ? getRecentApplications({ id: userId, isAdmin }, ACTIVITY_TAKE)
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

  const reviewedItems: ActivityItem[] = reviewed
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

  return { scope, mine, reviewed: reviewedItems };
});
