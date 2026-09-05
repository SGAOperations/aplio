import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import type { User } from '@/prisma/client';
import { getPositionDetail } from '@/prisma/data/positions';

import { getOptionalManagerAccess } from '@/lib/auth/guards';
import { requireName } from '@/lib/auth/server';
import { ACTION_ICONS, CONCEPT_ICONS, STATE_ICONS } from '@/lib/icons';
import type { PositionDetail } from '@/lib/types';
import {
  getPositionAvailability,
  getPositionDateInfo,
  markdownToPlainText,
} from '@/lib/utils';

import { PositionDateLine } from '@/components/features/position-date-line';
import { PositionStatusBadge } from '@/components/features/status-badge';
import { Button } from '@/components/ui/button';
import { LocalTime } from '@/components/ui/local-time';
import { Markdown } from '@/components/ui/markdown';
import { WarningCallout } from '@/components/ui/warning-callout';

async function resolvePositionView(
  id: string,
): Promise<{
  position: PositionDetail;
  user: User | null;
  canManage: boolean;
} | null> {
  const position = await getPositionDetail(id);
  if (!position) return null;

  const { user, canManage } = await getOptionalManagerAccess(position.managers);
  if (position.status === 'draft' && !canManage) return null;

  return { position, user, canManage };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const view = await resolvePositionView(id);
  if (!view) return {};
  return {
    title: view.position.title,
    description: markdownToPlainText(view.position.description).slice(0, 155),
  };
}

export default async function PublicPositionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const view = await resolvePositionView(id);
  if (!view) notFound();

  if (view.user) await requireName(view.user);

  const { position, canManage } = view;
  const isAuthenticated = view.user !== null;
  const availability = getPositionAvailability(position);
  const isAccepting = availability === 'accepting';
  const dateInfo = getPositionDateInfo(position);
  const staleDraftDate =
    position.status === 'draft' && dateInfo?.emphasis === 'stale'
      ? dateInfo
      : null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href={canManage ? '/manage/positions' : '/positions'}
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm transition-colors"
        >
          &larr; {canManage ? 'Back to Manage Positions' : 'Back to positions'}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {position.title}
          </h1>
          <PositionStatusBadge position={position} />
        </div>
        <PositionDateLine position={position} className="mt-3 text-base" />
      </div>

      {position.status === 'draft' && (
        <WarningCallout icon={STATE_ICONS.hidden}>
          <div className="flex flex-col gap-1">
            <p className="font-medium">This position is a draft.</p>
            <p>
              Only its managers and admins can see this page. Set it to Open in
              Edit to make it visible to applicants.
            </p>
            {staleDraftDate && (
              <p>
                Its scheduled{' '}
                {staleDraftDate.label === 'Was scheduled to open'
                  ? 'open'
                  : 'close'}{' '}
                date, <LocalTime date={staleDraftDate.date} precision="date" />,
                has already passed — update its dates in Edit if the schedule no
                longer applies.
              </p>
            )}
          </div>
        </WarningCallout>
      )}

      <div className="max-w-2xl">
        {markdownToPlainText(position.description) ? (
          <Markdown variant="full" source={position.description} />
        ) : (
          <p className="text-muted-foreground text-sm italic">
            No description yet.
          </p>
        )}
      </div>

      {(position.questions.length > 0 || canManage) && (
        <div className="max-w-2xl">
          <h2 className="mb-3 flex items-center gap-2 text-base font-medium">
            <CONCEPT_ICONS.question className="text-muted-foreground size-4" />
            Application questions
          </h2>
          {position.questions.length > 0 ? (
            <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
              {position.questions.map((question) => (
                <li key={question.id}>{question.label}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              No application questions yet — add them in Edit.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {isAccepting &&
          (isAuthenticated ? (
            <Button asChild>
              <Link href={`/positions/${id}/apply`}>
                <ACTION_ICONS.submit />
                Apply now
              </Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href={`/login?redirectTo=/positions/${id}/apply`}>
                <ACTION_ICONS.submit />
                Apply
              </Link>
            </Button>
          ))}
        {canManage && (
          <>
            <Button asChild variant="outline">
              <Link href={`/manage/positions/${id}/edit`}>
                <ACTION_ICONS.edit />
                Edit
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/manage/applications?positionId=${id}`}>
                <CONCEPT_ICONS.application />
                Applications
              </Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
