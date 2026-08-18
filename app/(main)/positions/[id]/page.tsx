import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { EyeOff, Inbox, Pencil } from 'lucide-react';

import type { User } from '@/prisma/client';
import { getPositionDetail } from '@/prisma/data/positions';

import { getOptionalManagerAccess } from '@/lib/auth/guards';
import { requireName } from '@/lib/auth/server';
import type { PositionDetail } from '@/lib/types';
import { getPositionAvailability } from '@/lib/utils';

import { PositionStatusBadge } from '@/components/features/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LocalTime } from '@/components/ui/local-time';
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
    description: view.position.description.slice(0, 155),
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
  const isClosed =
    availability === 'closed_by_date' || position.status === 'closed';
  const description = position.description.trim();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/positions"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm transition-colors"
        >
          &larr; Back to positions
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {position.title}
          </h1>
          <PositionStatusBadge position={position} />
        </div>
      </div>

      {position.status === 'draft' && (
        <WarningCallout icon={EyeOff}>
          <p className="font-medium">This position is a draft.</p>
          <p>
            Only its managers and admins can see this page. Set it to Open in
            Edit to make it visible to applicants.
          </p>
        </WarningCallout>
      )}

      <div className="max-w-2xl">
        {description ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {description}
          </p>
        ) : (
          <p className="text-muted-foreground text-sm italic">
            No description yet.
          </p>
        )}
      </div>

      {(position.questions.length > 0 || canManage) && (
        <div className="max-w-2xl">
          <h2 className="mb-3 text-base font-medium">Application questions</h2>
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
        {isAccepting && (
          <>
            {isAuthenticated ? (
              <Button asChild>
                <Link href={`/positions/${id}/apply`}>Apply now</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href={`/login?redirectTo=/positions/${id}/apply`}>
                  Apply
                </Link>
              </Button>
            )}
            {position.closesAt && (
              <span className="text-muted-foreground text-sm">
                Closes{' '}
                <LocalTime date={position.closesAt} precision="datetime" />
              </span>
            )}
          </>
        )}
        {availability === 'upcoming' && position.opensAt && (
          <Badge variant="secondary">
            Opens <LocalTime date={position.opensAt} precision="datetime" />
          </Badge>
        )}
        {isClosed && position.closesAt && (
          <span className="text-muted-foreground text-sm">
            Closed <LocalTime date={position.closesAt} precision="datetime" />
          </span>
        )}
        {canManage && (
          <>
            <Button asChild variant="outline">
              <Link href={`/positions/${id}/edit`}>
                <Pencil className="size-4" />
                Edit
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/applications?positionId=${id}`}>
                <Inbox className="size-4" />
                Applications
              </Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
