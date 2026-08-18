import { redirect } from 'next/navigation';

import { isManager } from '@/prisma/data/managers';

import { getOptionalUser, requireName } from '@/lib/auth/server';

import { AdminDashboard } from '@/components/features/admin-dashboard';
import { ManagerDashboard } from '@/components/features/manager-dashboard';
import { UserDashboard } from '@/components/features/user-dashboard';

export default async function Home() {
  const user = await getOptionalUser();
  // Routing, not an authorization denial.
  if (!user) redirect('/positions');

  // Sits outside app/(main)/(auth)/, so gate it directly.
  await requireName(user);

  if (user.isAdmin) return <AdminDashboard reviewer={user} />;

  // Cached: app/(main)/layout.tsx already calls this for non-admins.
  if (await isManager(user.id)) return <ManagerDashboard user={user} />;

  return <UserDashboard userId={user.id} userName={user.name} />;
}
