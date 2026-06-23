import { getCurrentUser } from '@/lib/auth/server';

import { AdminDashboard } from '@/components/features/admin-dashboard';
import { UserDashboard } from '@/components/features/user-dashboard';

export default async function Home() {
  const user = await getCurrentUser();

  if (user.isAdmin) return <AdminDashboard />;

  return <UserDashboard userId={user.id} userName={user.name} />;
}
