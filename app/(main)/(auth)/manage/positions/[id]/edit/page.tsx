import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getPositionApplicationStats } from '@/prisma/data/applications';
import {
  getPositionDeletionSummary,
  getPositionForEdit,
} from '@/prisma/data/positions';

import { requireListedManagerOr404 } from '@/lib/auth/guards';
import {
  POSITION_LIVE_EDIT_WARNING,
  UNRESOLVED_APPLICATION_STATUSES,
} from '@/lib/constants';
import { toOrgDayString } from '@/lib/dates';
import { CONCEPT_ICONS, STATE_ICONS } from '@/lib/icons';
import {
  getPositionDateInfo,
  isOpenPastCloseDate,
  isPositionActive,
} from '@/lib/utils';

import { PositionAvailabilitySection } from '@/components/features/position-availability-section';
import { PositionDangerZone } from '@/components/features/position-danger-zone';
import { PositionDetailsSection } from '@/components/features/position-details-section';
import { PositionManagersReadonly } from '@/components/features/position-managers-readonly';
import { PositionManagersSection } from '@/components/features/position-managers-section';
import { PositionQuestionsReadonly } from '@/components/features/position-questions-readonly';
import { PositionQuestionsSection } from '@/components/features/position-questions-section';
import { PositionStatusHeaderActions } from '@/components/features/position-status-header-actions';
import { PositionStatusBadge } from '@/components/features/status-badge';
import { PageHeader } from '@/components/layouts/page-header';
import { LocalTime } from '@/components/ui/local-time';
import { Markdown } from '@/components/ui/markdown';
import { SectionCard } from '@/components/ui/section-card';
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
  const closesAtPast =
    position.closesAt !== null && position.closesAt < new Date();
  const staleCloseDate = isOpenPastCloseDate(position)
    ? position.closesAt
    : null;
  const dateInfo = getPositionDateInfo(position);
  const draftPastDate =
    position.status === 'draft' && dateInfo?.emphasis === 'stale'
      ? dateInfo
      : null;
  const draftPastOpenDate = draftPastDate?.label === 'Was scheduled to open';

  const [deletionSummary, stats] = await Promise.all([
    user.isAdmin ? getPositionDeletionSummary(position.id) : null,
    getPositionApplicationStats([position.id]),
  ]);

  const counts = stats.get(position.id)?.counts ?? {};
  const unresolvedTotal = UNRESOLVED_APPLICATION_STATUSES.reduce(
    (sum, status) => sum + (counts[status] ?? 0),
    0,
  );

  const availabilityWarnings = (staleCloseDate || draftPastDate) && (
    <div className="flex flex-col gap-2">
      {staleCloseDate && (
        <WarningCallout>
          <div className="flex flex-col gap-1">
            <p className="font-medium">
              Applicants see this position as Closed.
            </p>
            <p>
              Its close date passed on{' '}
              <LocalTime date={staleCloseDate} precision="date" />, so it
              stopped accepting applications even though its status is still
              Open. Give it a future close date to reopen it, or choose Close
              position to make that explicit.
            </p>
          </div>
        </WarningCallout>
      )}
      {draftPastDate && (
        <WarningCallout>
          <div className="flex flex-col gap-1">
            <p className="font-medium">
              This position was scheduled to{' '}
              {draftPastOpenDate ? 'open' : 'close'}.
            </p>
            <p>
              Its {draftPastOpenDate ? 'open' : 'close'} date passed on{' '}
              <LocalTime date={draftPastDate.date} precision="date" />, but
              it&apos;s still a draft, so applicants can&apos;t see it. Give it
              a future {draftPastOpenDate ? 'open' : 'close'} date, or{' '}
              {user.isAdmin
                ? 'choose Open position to open it now.'
                : 'ask an admin to open it.'}
            </p>
          </div>
        </WarningCallout>
      )}
    </div>
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <PageHeader
        title={position.title}
        description={canEdit ? 'Edit position' : 'View position'}
        backHref="/manage/positions"
        backLabel="Back to Manage Positions"
        titleAdornment={<PositionStatusBadge position={position} />}
        actions={
          canEdit ? (
            <PositionStatusHeaderActions
              positionId={position.id}
              currentStatus={position.status}
              isAdmin={user.isAdmin}
              hasApplications={position.hasApplications}
              closesAtPast={closesAtPast}
              unresolvedApplicationCount={unresolvedTotal}
            />
          ) : undefined
        }
      />

      {position.status !== 'draft' && (
        <WarningCallout>{POSITION_LIVE_EDIT_WARNING}</WarningCallout>
      )}

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
                  href={`/manage/applications?positionId=${position.id}`}
                  className="underline underline-offset-2"
                >
                  Review applications
                </Link>
              </p>
            )}
          </div>
        </WarningCallout>
      )}

      <SectionCard title="Details" icon={CONCEPT_ICONS.position} titleAs="h2">
        <div className="flex flex-col gap-4 p-4">
          {canEdit && availabilityWarnings}
          {canEdit ? (
            <PositionDetailsSection
              positionId={position.id}
              title={position.title}
              description={position.description}
            >
              <PositionAvailabilitySection
                positionId={position.id}
                opensAt={
                  position.opensAt ? toOrgDayString(position.opensAt) : null
                }
                closesAt={
                  position.closesAt ? toOrgDayString(position.closesAt) : null
                }
              />
            </PositionDetailsSection>
          ) : (
            <>
              <div>
                <p className="text-muted-foreground text-xs">Title</p>
                <p className="text-sm font-medium">{position.title}</p>
              </div>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground text-xs">Opens</dt>
                  <dd className="text-sm">
                    {position.opensAt ? (
                      <LocalTime date={position.opensAt} precision="datetime" />
                    ) : (
                      <span className="text-muted-foreground">Not set</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Closes</dt>
                  <dd className="text-sm">
                    {position.closesAt ? (
                      <LocalTime
                        date={position.closesAt}
                        precision="datetime"
                      />
                    ) : (
                      <span className="text-muted-foreground">Not set</span>
                    )}
                  </dd>
                </div>
              </dl>
              <div>
                <p className="text-muted-foreground text-xs">Description</p>
                {position.description ? (
                  <Markdown variant="full" source={position.description} />
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No description
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard title="Managers" icon={CONCEPT_ICONS.user} titleAs="h2">
          <div className="p-4">
            {canEdit ? (
              <PositionManagersSection
                positionId={position.id}
                initialManagers={position.managers}
                currentUserId={user.id}
                isAdmin={user.isAdmin}
              />
            ) : (
              <PositionManagersReadonly managers={position.managers} />
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Questions"
          icon={CONCEPT_ICONS.question}
          titleAs="h2"
        >
          <div className="p-4">
            {canEdit ? (
              <PositionQuestionsSection
                positionId={position.id}
                initialQuestions={position.questions}
              />
            ) : (
              <PositionQuestionsReadonly questions={position.questions} />
            )}
          </div>
        </SectionCard>
      </div>

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
