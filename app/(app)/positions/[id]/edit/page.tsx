import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth/server';
import { getPositionForEdit } from '@/prisma/services/positions';

import { PositionDetailsForm } from '@/components/features/position-details-form';
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

  const position = await getPositionForEdit(id);

  if (!position) redirect('/positions');

  const isManager = position.managers.some((m) => m.id === user.id);
  if (!user.isAdmin && !isManager) redirect(`/positions/${id}`);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit Position
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">{position.title}</p>
      </div>

      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">Details</h2>
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
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">Application Questions</h2>
          <PositionQuestionsSection
            positionId={position.id}
            initialQuestions={position.questions}
          />
        </section>

        {user.isAdmin && (
          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-medium">Managers</h2>
            <PositionManagersSection
              positionId={position.id}
              initialManagers={position.managers}
              isAdmin={user.isAdmin}
            />
          </section>
        )}
      </div>
    </div>
  );
}
