import { getMyApplications } from '@/prisma/data/applications';

import { getCurrentUser } from '@/lib/auth/server';

import { MyApplicationsTable } from '@/components/features/my-applications-table';
import { PageHeader } from '@/components/layouts/page-header';

export default async function MyApplicationsPage() {
  const user = await getCurrentUser();
  const applications = await getMyApplications(user.id);

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        title="My Applications"
        description="Track your drafts and submitted applications."
      />
      <MyApplicationsTable applications={applications} />
    </div>
  );
}
