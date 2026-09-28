import type { ReactNode } from 'react';

import { CONCEPT_ICONS } from '@/lib/icons';
import { INSIGHT_CARD_SKELETON_HEIGHT_CLASS } from '@/lib/insights';

import {
  InsightDataTable,
  type InsightDataTableProps,
} from '@/components/features/insights/insight-data-table';
import { Card, CardContent } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';

interface InsightCardProps {
  title: string;
  description: string;
  meta?: string;
  takeaway?: string;
  isEmpty?: boolean;
  emptyMessage?: string;
  table?: InsightDataTableProps;
  children: ReactNode;
}

/** A `<figure>`-wrapped card: title, one-line description, n/coverage meta,
 * the chart slot, a takeaway caption, and a "View data" table. */
export function InsightCard({
  title,
  description,
  meta,
  takeaway,
  isEmpty = false,
  emptyMessage = 'No data in this range.',
  table,
  children,
}: InsightCardProps) {
  return (
    <Card className="min-w-0 gap-3">
      <figure>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
        {meta && <p className="text-muted-foreground mt-1 text-xs">{meta}</p>}

        <CardContent className="mt-3 px-0">
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

        {table && !isEmpty && (
          <Collapsible className="mt-3">
            <CollapsibleTrigger className="text-primary text-xs font-medium hover:underline">
              View data
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <InsightDataTable {...table} />
            </CollapsibleContent>
          </Collapsible>
        )}
      </figure>
    </Card>
  );
}

export function InsightCardSkeleton({ title }: { title?: string }) {
  return (
    <Card className="min-w-0 gap-3">
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
