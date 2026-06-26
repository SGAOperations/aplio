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

  // Name gate is universal — every role must set a name before accessing the app.
  if (!user.name?.trim()) redirect('/profile');

  if (user.isAdmin) return <>{children}</>;

  if (await isManager(user.id)) return <>{children}</>;

  const { complete } = await getProfileCompleteness(user.id);
  if (!complete) redirect('/profile');

  return <>{children}</>;
}
