import { redirect } from 'next/navigation';

import { getOptionalUser, requireName } from '@/lib/auth/server';

import { AdminDashboard } from '@/components/features/admin-dashboard';
import { UserDashboard } from '@/components/features/user-dashboard';

export default async function Home() {
  const user = await getOptionalUser();
  // Routing, not an authorization denial.
  if (!user) redirect('/positions');

  // Name gate — this personalized dashboard sits outside app/(main)/(auth)/,
  // so it isn't covered by that layout's check; gate it directly instead of
  // moving the check up to app/(main)/layout.tsx, which would also gate the
  // intentionally-public /positions and /positions/[id] routes.
  await requireName(user);

  if (user.isAdmin) return <AdminDashboard />;

  // Managers get UserDashboard too: their pipeline view lives in the Applications hub.
  return <UserDashboard userId={user.id} userName={user.name} />;
}
