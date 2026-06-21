import { redirect } from 'next/navigation';

import { getPositionForEdit } from '@/prisma/services/positions';

import { getCurrentUser } from '@/lib/auth/server';

import { PositionDetailsForm } from '@/components/features/position-details-form';
import { PositionEditTabs } from '@/components/features/position-edit-tabs';
import { PositionManagersSection } from '@/components/features/position-managers-section';
import { PositionQuestionsSection } from '@/components/features/position-questions-section';

interface EditPositionPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPositionPage({
  params,
}: EditPositionPageProps) {
  const { id } = await params;
  const user = await getCurrentUser();

  // Fetch position after confirming user is authenticated; access check below verifies
  // admin or manager status before the page renders.
  const position = await getPositionForEdit(id);

  if (!position) redirect('/positions');

  // Access check: admins always have access; managers are confirmed after the DB fetch
  // because the manager list is part of the position record.
  const isManager = position.managers.some((m) => m.id === user.id);
  if (!user.isAdmin && !isManager) redirect(`/positions/${id}`);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{position.title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">Edit position</p>
      </div>

      <PositionEditTabs
        detailsContent={
          <PositionDetailsForm
            position={{
              id: position.id,
              title: position.title,
              description: position.description,
              status: position.status,
              opensAt: position.opensAt?.toISOString() ?? null,
              closesAt: position.closesAt?.toISOString() ?? null,
            }}
          />
        }
        questionsContent={
          <PositionQuestionsSection
            positionId={position.id}
            initialQuestions={position.questions}
          />
        }
        managersContent={
          user.isAdmin ? (
            <PositionManagersSection
              positionId={position.id}
              initialManagers={position.managers}
              isAdmin={user.isAdmin}
            />
          ) : null
        }
      />
    </div>
  );
}
