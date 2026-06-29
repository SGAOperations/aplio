import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getPositionForEdit } from '@/prisma/data/positions';

import { getCurrentUser } from '@/lib/auth/server';

import { PositionDetailsForm } from '@/components/features/position-details-form';
import { PositionEditTabs } from '@/components/features/position-edit-tabs';
import { PositionManagersSection } from '@/components/features/position-managers-section';
import { PositionQuestionsSection } from '@/components/features/position-questions-section';
import { PageHeader } from '@/components/layouts/page-header';

interface EditPositionPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: EditPositionPageProps): Promise<Metadata> {
  const { id } = await params;
  const position = await getPositionForEdit(id);
  if (!position) return {};
  return { title: `Edit: ${position.title}` };
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
  const isPositionManager = position.managers.some((m) => m.id === user.id);
  if (!user.isAdmin && !isPositionManager) redirect(`/positions/${id}`);

  // canManage: admin always; managers confirmed above via the position record.
  const canManage = user.isAdmin || isPositionManager;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={position.title}
        description="Edit position"
        backHref="/positions"
        backLabel="Back to positions"
      />

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
          canManage ? (
            <PositionManagersSection
              positionId={position.id}
              initialManagers={position.managers}
              canManage={canManage}
            />
          ) : null
        }
      />
    </div>
  );
}
