import Link from 'next/link';
import { redirect } from 'next/navigation';

import { FileQuestion, Inbox, Pencil } from 'lucide-react';

import { getPositionDetail } from '@/prisma/data/positions';

import { getCurrentUser } from '@/lib/auth/server';
import { QUESTION_TYPE_LABELS } from '@/lib/constants';
import { formatDate, getPositionAvailability } from '@/lib/utils';

import { PositionStatusBadge } from '@/components/features/status-badge';
import { PageHeader } from '@/components/layouts/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface PositionDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PositionDetailPage({
  params,
}: PositionDetailPageProps) {
  const { id } = await params;
  const user = await getCurrentUser();

  const position = await getPositionDetail(id);

  // Stale or deleted link → send the user back to the list.
  if (!position) redirect('/positions');

  const isManager = position.managers.some((m) => m.id === user.id);
  const isAdminOrManager = user.isAdmin || isManager;
  const availability = getPositionAvailability(position);

  // Draft gate: non-admins/non-managers see a friendly notice — not an error page,
  // not a redirect — because a draft URL is a legitimately reachable state (stale link).
  if (position.status === 'draft' && !isAdminOrManager) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <PageHeader
          title="Position not available"
          backHref="/positions"
          backLabel="Back to positions"
        />
        <div className="bg-muted rounded-lg p-6">
          <p className="font-medium">This position is not available</p>
          <p className="text-muted-foreground mt-1 text-sm">
            This position isn&apos;t open for applications right now.
          </p>
        </div>
      </div>
    );
  }

  const adminActions = isAdminOrManager ? (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" size="sm">
        <Link href={`/positions/${id}/edit`}>
          <Pencil className="size-4" />
          Edit
        </Link>
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href={`/applications?positionId=${id}`}>
          <Inbox className="size-4" />
          View Applications
        </Link>
      </Button>
    </div>
  ) : undefined;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={position.title}
        backHref="/positions"
        backLabel="Back to positions"
        actions={adminActions}
      />

      {/* Status + dates */}
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <PositionStatusBadge position={position} />
          {position.opensAt && (
            <span className="text-muted-foreground text-sm">
              Opens {formatDate(position.opensAt)}
            </span>
          )}
          {position.closesAt && (
            <span className="text-muted-foreground text-sm">
              Closes {formatDate(position.closesAt)}
            </span>
          )}
        </div>
      </div>

      {/* Full description */}
      <section>
        <h2 className="text-lg font-semibold">Description</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed whitespace-pre-line">
          {position.description}
        </p>
      </section>

      {/* Questions preview */}
      <section>
        <h2 className="text-lg font-semibold">Application questions</h2>
        {position.questions.length === 0 ? (
          <div className="text-muted-foreground mt-2 flex items-center gap-2 text-sm">
            <FileQuestion className="size-4 shrink-0" />
            <span>No additional questions for this position.</span>
          </div>
        ) : (
          <ul className="mt-2 flex flex-col gap-3">
            {position.questions.map((q) => (
              <li key={q.id} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{q.label}</span>
                  <Badge variant="secondary" className="text-xs">
                    {QUESTION_TYPE_LABELS[q.type]}
                  </Badge>
                  {q.required && (
                    <Badge variant="outline" className="text-xs">
                      Required
                    </Badge>
                  )}
                </div>
                {(q.type === 'single_choice' || q.type === 'multiple_choice') &&
                  q.options.length > 0 && (
                    <ul className="text-muted-foreground ml-1 list-inside list-disc text-xs">
                      {q.options.map((opt) => (
                        <li key={opt}>{opt}</li>
                      ))}
                    </ul>
                  )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Apply CTA or status notice for applicants */}
      {!isAdminOrManager && (
        <div>
          {availability === 'accepting' ? (
            <Button asChild>
              <Link href={`/positions/${id}/apply`}>Apply</Link>
            </Button>
          ) : availability === 'upcoming' && position.opensAt ? (
            <p className="text-muted-foreground text-sm">
              Applications open {formatDate(position.opensAt)}.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Applications are closed for this position.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
