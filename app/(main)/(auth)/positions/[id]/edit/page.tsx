import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getPositionForEdit } from '@/prisma/data/positions';

import { requireListedManagerOr404 } from '@/lib/auth/guards';

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

  // Missing checked before the access guard, so both paths 404 identically.
  const position = await getPositionForEdit(id);
  if (!position) notFound();

  // Reuses the managers list above; denial is a 404, so nothing leaks existence.
  const user = await requireListedManagerOr404(position.managers);

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
          <PositionManagersSection
            positionId={position.id}
            initialManagers={position.managers}
            currentUserId={user.id}
            isAdmin={user.isAdmin}
          />
        }
      />
    </div>
  );
}
