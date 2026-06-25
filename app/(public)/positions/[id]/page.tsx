import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Inbox, Pencil } from 'lucide-react';

import { getPublicPosition } from '@/prisma/data/positions';

import { getOptionalUser } from '@/lib/auth/server';
import { AVAILABILITY_LABELS, AVAILABILITY_VARIANTS } from '@/lib/constants';
import { formatDate, getPositionAvailability } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const position = await getPublicPosition(id);
  if (!position) return {};
  return {
    title: position.title,
    description: position.description.slice(0, 155),
  };
}

export default async function PublicPositionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [position, user] = await Promise.all([
    getPublicPosition(id),
    getOptionalUser(),
  ]);

  if (!position) notFound();

  const isAdmin = user?.isAdmin ?? false;
  const isAuthenticated = user !== null;
  const availability = getPositionAvailability(position);
  const isAccepting = availability === 'accepting';

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
          <Badge variant={AVAILABILITY_VARIANTS[availability]}>
            {AVAILABILITY_LABELS[availability]}
          </Badge>
        </div>
      </div>

      <div className="max-w-2xl">
        <p className="text-muted-foreground text-sm leading-relaxed">
          {position.description}
        </p>
      </div>

      {position.questions.length > 0 && (
        <div className="max-w-2xl">
          <h2 className="mb-3 text-base font-medium">Application questions</h2>
          <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
            {position.questions.map((question) => (
              <li key={question.id}>{question.label}</li>
            ))}
          </ul>
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
              <div className="flex flex-col gap-2">
                <Button asChild>
                  <Link href={`/login?redirectTo=/positions/${id}/apply`}>
                    Apply now
                  </Link>
                </Button>
                <p className="text-muted-foreground text-xs">
                  We&apos;ll send you a one-time code to continue your
                  application.
                </p>
              </div>
            )}
            {position.closesAt && (
              <span className="text-muted-foreground text-sm">
                Closes {formatDate(position.closesAt)}
              </span>
            )}
          </>
        )}
        {availability === 'upcoming' && position.opensAt && (
          <Badge variant="secondary">
            Opens {formatDate(position.opensAt)}
          </Badge>
        )}
        {availability === 'closed_by_date' && (
          <Badge variant="outline">Closed</Badge>
        )}
        {isAdmin && (
          <>
            <Button asChild variant="outline">
              <Link href={`/positions/${id}/edit`}>
                <Pencil className="size-4" />
                Edit
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/positions/${id}/applications`}>
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
