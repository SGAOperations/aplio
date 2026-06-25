import type { ReactNode } from 'react';

import { getCurrentUser, getIsBypass } from '@/lib/auth/server';
import prisma from '@/lib/prisma';
import type { NavIdentity } from '@/lib/types';

import { AppFooter } from '@/components/layouts/app-footer';
import { MobileNav } from '@/components/layouts/mobile-nav';
import { Sidebar } from '@/components/layouts/sidebar';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  const roleLabel = user.isAdmin ? 'Admin' : 'User';
  const isBypass = await getIsBypass();

  const identity: NavIdentity = {
    name: user.name,
    email: user.email,
    roleLabel,
    isBypass,
  };

  // Admins always see reviewer nav; managers see it only while they manage ≥1 position.
  const canReviewApplications =
    user.isAdmin ||
    (await prisma.position.count({
      where: { managers: { some: { id: user.id } }, deletedAt: null },
    })) > 0;

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <Sidebar
        isAdmin={user.isAdmin}
        identity={identity}
        canReviewApplications={canReviewApplications}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <MobileNav
          isAdmin={user.isAdmin}
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
