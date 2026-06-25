import { redirect } from 'next/navigation';

import { getPositionApplications } from '@/prisma/data/applications';
import { getPositionAccess } from '@/prisma/data/positions';

import { getCurrentUser } from '@/lib/auth/server';

import { PositionApplicationsTable } from '@/components/features/position-applications-table';
import { PageHeader } from '@/components/layouts/page-header';

interface PositionApplicationsPageProps {
  params: Promise<{ id: string }>;
}

export default async function PositionApplicationsPage({
  params,
}: PositionApplicationsPageProps) {
  const { id } = await params;
  const user = await getCurrentUser();

  const position = await getPositionAccess(id);

  if (!position) redirect('/positions');

  // Access check: admins always have access; managers are confirmed via the DB fetch.
  const isManager = position.managers.some((m) => m.id === user.id);
  if (!user.isAdmin && !isManager) redirect(`/positions/${id}`);

  const applications = await getPositionApplications(id);

  const count = applications.length;
  const countLabel =
    count === 1 ? '1 application' : count > 0 ? `${count} applications` : null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title={position.title}
        description={countLabel ?? undefined}
        backHref="/positions"
        backLabel="Back to positions"
      />

      <PositionApplicationsTable applications={applications} />
    </div>
  );
}
