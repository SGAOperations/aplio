import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { isManager } from '@/prisma/data/managers';
import { getProfileCompleteness } from '@/prisma/data/profile';

import { withRedirectTo } from '@/lib/auth/redirect';
import { currentPath, getCurrentUser, requireName } from '@/lib/auth/server';

export default async function AuthGateLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();

  // Name gate (see lib/auth/server.ts for the full rationale) — covers every
  // route this layout wraps.
  await requireName(user);

  if (user.isAdmin) return <>{children}</>;

  if (await isManager(user.id)) return <>{children}</>;

  // Onboarding gate, not an authorization denial.
  const { complete } = await getProfileCompleteness(user.id);
  if (!complete) redirect(withRedirectTo('/profile', await currentPath()));

  return <>{children}</>;
}
