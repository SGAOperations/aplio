import { redirect } from 'next/navigation';

import { getOptionalUser } from '@/lib/auth/server';

import { AdminDashboard } from '@/components/features/admin-dashboard';
import { UserDashboard } from '@/components/features/user-dashboard';

export default async function Home() {
  const user = await getOptionalUser();
  if (!user) redirect('/positions');

  if (user.isAdmin) return <AdminDashboard />;

  // Managers intentionally use UserDashboard — they are also regular users who can apply.
  // A bespoke manager dashboard (managed-position pipeline) belongs to the Applications
  // hub (#150) and would duplicate that work here.
  return <UserDashboard userId={user.id} userName={user.name} />;
}
