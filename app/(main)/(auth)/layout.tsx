import type { ReactNode } from 'react';

import { getCurrentUser, requireName } from '@/lib/auth/server';

export default async function AuthGateLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();

  // Name gate (see lib/auth/server.ts for the full rationale) — covers every
  // route this layout wraps.
  await requireName(user);

  return <>{children}</>;
}
