import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getUsersForAdmin } from '@/prisma/data/users';

import { getCurrentUser } from '@/lib/auth/server';

import { CreateUserDialog } from '@/components/features/create-user-dialog';
import { UsersTable } from '@/components/features/users-table';
import { PageHeader } from '@/components/layouts/page-header';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Users' };

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!user.isAdmin) redirect('/');

  const users = await getUsersForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Users"
        actions={<CreateUserDialog trigger={<Button>Create user</Button>} />}
      />

      <UsersTable users={users} currentUserId={user.id} />
    </div>
  );
}
