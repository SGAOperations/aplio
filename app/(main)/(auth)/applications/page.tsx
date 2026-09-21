import type { Metadata } from 'next';

import {
  getApplicationCompletion,
  getMyApplications,
} from '@/prisma/data/applications';

import { getCurrentUser } from '@/lib/auth/server';

import { MyApplicationsTable } from '@/components/features/my-applications-table';
import { PageHeader } from '@/components/layouts/page-header';

export const metadata: Metadata = { title: 'My Applications' };

export default async function MyApplicationsPage() {
  const user = await getCurrentUser();
  const applications = await getMyApplications(user.id);
  const now = new Date();
  const completion = await getApplicationCompletion(
    applications
      .filter((a) => a.status === 'draft')
      .map((a) => ({ id: a.id, positionId: a.positionId, userId: user.id })),
  );

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        title="My Applications"
        description="Track your drafts and submitted applications."
      />
      <MyApplicationsTable
        applications={applications}
        now={now}
        completion={completion}
      />
    </div>
  );
}
