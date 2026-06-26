import { redirect } from 'next/navigation';

import { getUsersForAdmin } from '@/prisma/data/users';

import { getCurrentUser } from '@/lib/auth/server';

import { UsersTable } from '@/components/features/users-table';
import { PageHeader } from '@/components/layouts/page-header';

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!user.isAdmin) redirect('/');

  const users = await getUsersForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Users"
        description={`${users.length} ${users.length === 1 ? 'user' : 'users'}`}
      />

      <UsersTable users={users} currentUserId={user.id} />
    </div>
  );
}
