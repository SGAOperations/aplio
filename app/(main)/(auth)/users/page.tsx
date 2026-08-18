import type { Metadata } from 'next';
import Link from 'next/link';

import { getUsersForAdmin } from '@/prisma/data/users';

import { requireAdminOr404 } from '@/lib/auth/guards';

import { CreateUserDialog } from '@/components/features/create-user-dialog';
import { UsersTable } from '@/components/features/users-table';
import { PageHeader } from '@/components/layouts/page-header';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Users' };

export default async function UsersPage() {
  const user = await requireAdminOr404();

  const users = await getUsersForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Users"
        description="Manage platform accounts and admin access."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/users/deactivated">Deactivated accounts</Link>
            </Button>
            <CreateUserDialog trigger={<Button>Create user</Button>} />
          </>
        }
      />

      <UsersTable users={users} currentUserId={user.id} />
    </div>
  );
}
