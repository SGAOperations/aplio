'use client';

import Link from 'next/link';
import { useState } from 'react';

import { ChevronDown, ChevronUp, Inbox, Pencil } from 'lucide-react';

import type { PositionWithQuestions } from '@/lib/types';
import { formatDate, getPositionAvailability } from '@/lib/utils';

import { PositionStatusBadge } from '@/components/features/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PositionCardProps {
  position: PositionWithQuestions;
  showAdminActions?: boolean;
}

export function PositionCard({
  position,
  showAdminActions = false,
}: PositionCardProps) {
  const [open, setOpen] = useState(false);

  // Derive availability once per render so copy and button logic stay in sync.
  const availability = getPositionAvailability(position);
  const isAccepting = availability === 'accepting';

  return (
    <Card className="gap-0 p-0">
      <CardHeader className="p-0">
        <button
          type="button"
          className="flex w-full items-center justify-between p-4 text-left"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
        >
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">{position.title}</CardTitle>
            {showAdminActions && <PositionStatusBadge position={position} />}
          </div>
          {open ? (
            <ChevronUp className="text-muted-foreground size-5 shrink-0" />
          ) : (
            <ChevronDown className="text-muted-foreground size-5 shrink-0" />
          )}
        </button>
      </CardHeader>

      {open && (
        <CardContent className="flex flex-col gap-4 px-4 pb-4">
          <p className="text-muted-foreground text-sm">
            {position.description}
          </p>

          {position.questions.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Application questions</p>
              <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
                {position.questions.map(
                  (question: PositionWithQuestions['questions'][number]) => (
                    <li key={question.id}>{question.label}</li>
                  ),
                )}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            {showAdminActions ? (
              <>
                {isAccepting && (
                  <Button asChild>
                    <Link href={`/positions/${position.id}/apply`}>Apply</Link>
                  </Button>
                )}
                <Button asChild variant="outline">
                  <Link href={`/positions/${position.id}/edit`}>
                    <Pencil className="size-4" />
                    Edit
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/positions/${position.id}/applications`}>
                    <Inbox className="size-4" />
                    Applications
                  </Link>
                </Button>
              </>
            ) : (
              <>
                {isAccepting && (
                  <>
                    <Button asChild>
                      <Link href={`/positions/${position.id}/apply`}>
                        Apply
                      </Link>
                    </Button>
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
              </>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
