import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { isManager } from '@/prisma/data/managers';
import { getProfileCompleteness } from '@/prisma/data/profile';

import { getCurrentUser } from '@/lib/auth/server';

// Force every route under this auth-gate to re-render on each request so that
// auth state changes (deactivation, admin toggle) take effect on the affected
// user's very next navigation — no 30-second router-cache window.
export const dynamic = 'force-dynamic';

export default async function AuthGateLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();

  if (user.isAdmin) return <>{children}</>;

  if (await isManager(user.id)) return <>{children}</>;

  const { complete } = await getProfileCompleteness(user.id);
  if (!complete) redirect('/profile');

  return <>{children}</>;
}
