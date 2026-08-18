import type { Metadata } from 'next';

import { getDeactivatedUsersForAdmin } from '@/prisma/data/users';

import { requireAdminOr404 } from '@/lib/auth/guards';

import { DeactivatedUsersTable } from '@/components/features/deactivated-users-table';
import { PageHeader } from '@/components/layouts/page-header';

export const metadata: Metadata = { title: 'Deactivated Accounts' };

export default async function DeactivatedUsersPage() {
  await requireAdminOr404();

  const users = await getDeactivatedUsersForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Deactivated accounts"
        description="Restore access for accounts that were previously deactivated."
        backHref="/users"
        backLabel="Users"
      />

      <DeactivatedUsersTable users={users} />
    </div>
  );
}
