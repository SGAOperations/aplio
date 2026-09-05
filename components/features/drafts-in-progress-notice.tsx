import Link from 'next/link';

import { APPLICATION_STATUS_ICONS } from '@/lib/icons';
import type { ApplicationFilters } from '@/lib/types';
import { buildApplicationsHref } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface DraftsInProgressNoticeProps {
  count: number;
  filters: ApplicationFilters;
}

export function DraftsInProgressNotice({
  count,
  filters,
}: DraftsInProgressNoticeProps) {
  if (count === 0) return null;

  const noun = count === 1 ? 'application' : 'applications';

  return (
    <Card className="bg-muted/30 gap-0 p-0">
      <CardContent className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <APPLICATION_STATUS_ICONS.draft className="text-muted-foreground size-4 shrink-0" />
          <p className="text-sm">
            {count} {noun} in progress
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={buildApplicationsHref({ ...filters, status: 'draft' })}>
            View drafts
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
