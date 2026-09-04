import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getPositionApplicationStats } from '@/prisma/data/applications';
import {
  getPositionDeletionSummary,
  getPositionForEdit,
} from '@/prisma/data/positions';

import { requireListedManagerOr404 } from '@/lib/auth/guards';
import { UNRESOLVED_APPLICATION_STATUSES } from '@/lib/constants';
import { toOrgDayString } from '@/lib/dates';
import { STATE_ICONS } from '@/lib/icons';
import { isPositionActive } from '@/lib/utils';

import { PositionDangerZone } from '@/components/features/position-danger-zone';
import { PositionDetailsForm } from '@/components/features/position-details-form';
import { PositionDetailsReadonly } from '@/components/features/position-details-readonly';
import { PositionEditTabs } from '@/components/features/position-edit-tabs';
import { PositionManagersSection } from '@/components/features/position-managers-section';
import { PositionQuestionsReadonly } from '@/components/features/position-questions-readonly';
import { PositionQuestionsSection } from '@/components/features/position-questions-section';
import { PageHeader } from '@/components/layouts/page-header';
import { WarningCallout } from '@/components/ui/warning-callout';

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

  const canEdit = user.isAdmin || isPositionActive(position);

  const deletionSummary = user.isAdmin
    ? await getPositionDeletionSummary(position.id)
    : null;

  // Only the archived branch needs this — a single groupBy, not run on the happy path.
  let unresolvedTotal = 0;
  if (!canEdit) {
    const stats = await getPositionApplicationStats([position.id]);
    const counts = stats.get(position.id)?.counts ?? {};
    unresolvedTotal = UNRESOLVED_APPLICATION_STATUSES.reduce(
      (sum, status) => sum + (counts[status] ?? 0),
      0,
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={position.title}
        description={canEdit ? 'Edit position' : 'View position'}
        backHref="/manage/positions"
        backLabel="Back to Manage Positions"
      />

      {!canEdit && (
        <WarningCallout icon={STATE_ICONS.archived}>
          <div className="flex flex-col gap-1">
            <p className="font-medium">This position is archived.</p>
            <p>
              It closed more than 30 days ago and no application status has
              changed since, so its details and questions can no longer be
              edited. Ask an admin if something still needs updating.
            </p>
            {unresolvedTotal > 0 && (
              <p>
                {unresolvedTotal}{' '}
                {unresolvedTotal === 1 ? 'application is' : 'applications are'}{' '}
                still awaiting a decision — reviewing is not blocked.{' '}
                <Link
                  href={`/applications?positionId=${position.id}`}
                  className="underline underline-offset-2"
                >
                  Review applications
                </Link>
              </p>
            )}
          </div>
        </WarningCallout>
      )}

      <PositionEditTabs
        detailsContent={
          canEdit ? (
            <PositionDetailsForm
              position={{
                id: position.id,
                title: position.title,
                description: position.description,
                status: position.status,
                opensAt: position.opensAt
                  ? toOrgDayString(position.opensAt)
                  : null,
                closesAt: position.closesAt
                  ? toOrgDayString(position.closesAt)
                  : null,
              }}
            />
          ) : (
            <PositionDetailsReadonly
              position={{
                title: position.title,
                description: position.description,
                status: position.status,
                opensAt: position.opensAt,
                closesAt: position.closesAt,
              }}
            />
          )
        }
        questionsContent={
          canEdit ? (
            <PositionQuestionsSection
              positionId={position.id}
              initialQuestions={position.questions}
            />
          ) : (
            <PositionQuestionsReadonly questions={position.questions} />
          )
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

      {deletionSummary && (
        <PositionDangerZone
          positionId={position.id}
          positionTitle={position.title}
          summary={deletionSummary}
        />
      )}
    </div>
  );
}
