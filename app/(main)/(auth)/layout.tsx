import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { isManager } from '@/prisma/data/managers';
import { getProfileCompleteness } from '@/prisma/data/profile';

import { getCurrentUser } from '@/lib/auth/server';

export default async function AuthGateLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();

  // Name gate — nameless users must set their name before accessing any app route.
  // Carry the requested path (set by proxy.ts on `x-current-path`, since layouts
  // have no direct access to the request URL) so /login can route the user back
  // to their original destination — e.g. an in-progress application — after
  // they set their name, instead of dropping them at the generic listing.
  if (!user.name?.trim()) {
    const currentPath = (await headers()).get('x-current-path');
    const query = currentPath
      ? `?redirectTo=${encodeURIComponent(currentPath)}`
      : '';
    redirect(`/login${query}`);
  }

  if (user.isAdmin) return <>{children}</>;

  if (await isManager(user.id)) return <>{children}</>;

  // Onboarding gate, not an authorization denial — every applicant belongs
  // here, they just need to finish their profile first (lib/auth/guards.ts).
  const { complete } = await getProfileCompleteness(user.id);
  if (!complete) redirect('/profile');

  return <>{children}</>;
}
