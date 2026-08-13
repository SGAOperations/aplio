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

  if (user.isAdmin) return <>{children}</>;

  if (await isManager(user.id)) return <>{children}</>;

  // Onboarding gate, not an authorization denial — every applicant belongs
  // here, they just need to finish their profile first (lib/auth/guards.ts).
  const { complete } = await getProfileCompleteness(user.id);
  if (!complete) redirect('/profile');

  return <>{children}</>;
}
