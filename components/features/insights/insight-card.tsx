import type { ReactNode } from 'react';

import { CONCEPT_ICONS } from '@/lib/icons';
import { INSIGHT_CARD_SKELETON_HEIGHT_CLASS } from '@/lib/insights';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface InsightCardProps {
  title: string;
  description: string;
  meta?: string;
  takeaway?: string;
  isEmpty?: boolean;
  emptyMessage?: string;
  headerAction?: ReactNode;
  children: ReactNode;
}

/** A `<figure>`-wrapped card: title (with an optional top-right action), a
 * one-line description, n/coverage meta, the chart slot, and a takeaway
 * caption. */
export function InsightCard({
  title,
  description,
  meta,
  takeaway,
  isEmpty = false,
  emptyMessage = 'No data in this range.',
  headerAction,
  children,
}: InsightCardProps) {
  return (
    <Card className="min-w-0 gap-3 p-4">
      <figure>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          {headerAction}
        </div>
        <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
        {meta && <p className="text-muted-foreground mt-1 text-xs">{meta}</p>}

        <CardContent className="mt-2 px-0">
          {isEmpty ? (
            <div className="text-muted-foreground flex h-64 flex-col items-center justify-center gap-2 text-center text-sm">
              <CONCEPT_ICONS.insights className="size-8" />
              {emptyMessage}
            </div>
          ) : (
            children
          )}
        </CardContent>

        {takeaway && !isEmpty && (
          <figcaption className="text-muted-foreground mt-2 text-xs">
            {takeaway}
          </figcaption>
        )}
      </figure>
    </Card>
  );
}

export function InsightCardSkeleton({ title }: { title?: string }) {
  return (
    <Card className="min-w-0 gap-3 p-4">
      {title ? (
        <h3 className="text-sm font-semibold">{title}</h3>
      ) : (
        <Skeleton className="h-4 w-32" />
      )}
      <Skeleton className="h-3 w-48" />
      <Skeleton className={`mt-2 ${INSIGHT_CARD_SKELETON_HEIGHT_CLASS}`} />
    </Card>
  );
}
