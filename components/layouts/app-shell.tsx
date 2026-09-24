import { type ReactNode, Suspense } from 'react';

import { isManager } from '@/prisma/data/managers';

import { getIsBypass, getOptionalUser } from '@/lib/auth/server';
import { ACTIVITY_FEED_COPY } from '@/lib/constants';
import type { ActivityScope, NavIdentity } from '@/lib/types';

import {
  ActivityFeed,
  ActivityFeedListSkeleton,
} from '@/components/features/activity-feed';
import { ActivityPanel } from '@/components/features/activity-panel';
import { AppFooter } from '@/components/layouts/app-footer';
import { MobileNav } from '@/components/layouts/mobile-nav';
import { Sidebar } from '@/components/layouts/sidebar';

export async function AppShell({ children }: { children: ReactNode }) {
  const user = await getOptionalUser();

  let identity: NavIdentity | null = null;
  let isAdmin = false;
  let canReviewApplications = false;
  let activityPanel: ReactNode = null;

  if (user) {
    // Admins always see reviewer nav, so manager status matters only for the rest.
    const [userIsManager, isBypass] = await Promise.all([
      user.isAdmin ? Promise.resolve(false) : isManager(user.id),
      getIsBypass(),
    ]);
    canReviewApplications = user.isAdmin || userIsManager;
    isAdmin = user.isAdmin;

    const roleLabel = user.isAdmin
      ? 'Admin'
      : userIsManager
        ? 'Manager'
        : 'User';

    identity = { name: user.name, email: user.email, roleLabel, isBypass };

    const scope: ActivityScope = user.isAdmin
      ? 'all'
      : userIsManager
        ? 'managed'
        : 'none';

    activityPanel = (
      <ActivityPanel description={ACTIVITY_FEED_COPY[scope].description}>
        <Suspense fallback={<ActivityFeedListSkeleton scope={scope} />}>
          <ActivityFeed userId={user.id} isAdmin={user.isAdmin} />
        </Suspense>
      </ActivityPanel>
    );
  }

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <Sidebar
        isAdmin={isAdmin}
        identity={identity}
        canReviewApplications={canReviewApplications}
        activityPanel={activityPanel}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <MobileNav
          isAdmin={isAdmin}
          identity={identity}
          canReviewApplications={canReviewApplications}
          activityPanel={activityPanel}
        />
        <main
          id="main-content"
          className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto scroll-smooth motion-reduce:scroll-auto"
        >
          <div className="flex-1 p-6">{children}</div>
          <AppFooter />
        </main>
      </div>
    </div>
  );
}
