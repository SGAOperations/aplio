import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getPositionForEdit } from '@/prisma/data/positions';

import { requirePositionManagerOr404 } from '@/lib/auth/guards';

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

  // Fetch position after confirming user is authenticated (enforced by the
  // (auth) route group's layout.tsx); a missing position is a genuine 404,
  // and must be checked before the access guard so a deleted-position link
  // gives the same 404 either way rather than depending on guard-check
  // ordering.
  const position = await getPositionForEdit(id);
  if (!position) notFound();

  // Access check: admin or manager of this specific position, else 404 —
  // same denial as a genuinely missing position (no existence leak). Reuses
  // the managers list already fetched above instead of re-querying it.
  await requirePositionManagerOr404(position.managers);

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
          />
        }
      />
    </div>
  );
}
