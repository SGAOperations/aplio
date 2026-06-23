import type { ReactNode } from 'react';

import { getCurrentUser, getIsBypass } from '@/lib/auth/server';
import type { NavIdentity } from '@/lib/types';

import { MobileNav } from '@/components/layouts/mobile-nav';
import { Sidebar } from '@/components/layouts/sidebar';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  const roleLabel = user.isAdmin ? 'Admin' : 'User';
  const isBypass = await getIsBypass();

  const identity: NavIdentity = { email: user.email, roleLabel, isBypass };

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <Sidebar isAdmin={user.isAdmin} identity={identity} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <MobileNav isAdmin={user.isAdmin} identity={identity} />
        <main className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex-1 p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
