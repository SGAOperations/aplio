import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ArrowLeft } from 'lucide-react';

import { getPositionApplications } from '@/prisma/data/applications';
import { getPositionAccess } from '@/prisma/data/positions';

import { getCurrentUser } from '@/lib/auth/server';

import { PositionApplicationsTable } from '@/components/features/position-applications-table';
import { Button } from '@/components/ui/button';

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
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href={`/positions/${id}/edit`}>
            <ArrowLeft className="size-4" />
            Back to position
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">{position.title}</h1>
        {countLabel && (
          <p className="text-muted-foreground mt-1 text-sm">{countLabel}</p>
        )}
      </div>

      <PositionApplicationsTable applications={applications} />
    </div>
  );
}
