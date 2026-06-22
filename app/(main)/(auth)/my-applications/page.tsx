import { getMyApplications } from '@/prisma/data/applications';

import { getCurrentUser } from '@/lib/auth/server';

import { MyApplicationsTable } from '@/components/features/my-applications-table';

export default async function MyApplicationsPage() {
  const user = await getCurrentUser();
  const applications = await getMyApplications(user.id);

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          My Applications
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Track your drafts and submitted applications.
        </p>
      </div>

      <MyApplicationsTable applications={applications} />
    </div>
  );
}
