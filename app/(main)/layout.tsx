import type { ReactNode } from 'react';

import { isManager } from '@/prisma/data/managers';

import { getIsBypass, getOptionalUser } from '@/lib/auth/server';
import type { NavIdentity } from '@/lib/types';

import { AppFooter } from '@/components/layouts/app-footer';
import { MobileNav } from '@/components/layouts/mobile-nav';
import { Sidebar } from '@/components/layouts/sidebar';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getOptionalUser();

  let identity: NavIdentity | null = null;
  let isAdmin = false;
  let canReviewApplications = false;

  if (user) {
    // Admins always see reviewer nav; check manager status only for non-admins.
    const userIsManager = user.isAdmin ? false : await isManager(user.id);
    canReviewApplications = user.isAdmin || userIsManager;
    isAdmin = user.isAdmin;

    const roleLabel = user.isAdmin
      ? 'Admin'
      : userIsManager
        ? 'Manager'
        : 'User';
    const isBypass = await getIsBypass();

    identity = { name: user.name, email: user.email, roleLabel, isBypass };
  }

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <Sidebar
        isAdmin={isAdmin}
        identity={identity}
        canReviewApplications={canReviewApplications}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <MobileNav
          isAdmin={isAdmin}
          identity={identity}
          canReviewApplications={canReviewApplications}
        />
        <main className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex-1 p-6">{children}</div>
          <AppFooter />
        </main>
      </div>
    </div>
  );
}
