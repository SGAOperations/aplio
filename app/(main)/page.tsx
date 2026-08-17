import { redirect } from 'next/navigation';

import { getOptionalUser, requireName } from '@/lib/auth/server';

import { AdminDashboard } from '@/components/features/admin-dashboard';
import { UserDashboard } from '@/components/features/user-dashboard';

export default async function Home() {
  const user = await getOptionalUser();
  // Routing, not an authorization denial.
  if (!user) redirect('/positions');

  // Sits outside app/(main)/(auth)/, so gate it directly.
  await requireName(user);

  if (user.isAdmin) return <AdminDashboard />;

  // Managers get UserDashboard too: their pipeline view lives in the Applications hub.
  return <UserDashboard userId={user.id} userName={user.name} />;
}
