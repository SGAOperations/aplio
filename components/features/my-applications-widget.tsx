import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import {
  getMyApplicationStatusCounts,
  getRecentMyApplications,
} from '@/prisma/data/applications';

import { APPLICATION_STATUS_LABELS } from '@/lib/constants';
import { type MyApplicationListItem } from '@/lib/types';
import { formatDate } from '@/lib/utils';

import { ApplicationStatusBadge } from '@/components/features/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface MyApplicationsWidgetProps {
  userId: string;
}

function buildCountsSummary(counts: Partial<Record<string, number>>): string {
  // Drafts shown separately; skip zero counts.
  const draftCount = counts['draft'] ?? 0;
  const submittedParts: string[] = [];

  const statusOrder = [
    'applied',
    'reached_out',
    'interview_scheduled',
    'reviewing',
    'accepted',
    'rejected',
  ] as const;

  for (const status of statusOrder) {
    const count = counts[status];
    if (count && count > 0)
      submittedParts.push(
        `${count} ${APPLICATION_STATUS_LABELS[status].toLowerCase()}`,
      );
  }

  const parts: string[] = [];
  if (submittedParts.length > 0) parts.push(...submittedParts);
  if (draftCount > 0)
    parts.push(`${draftCount} ${draftCount === 1 ? 'draft' : 'drafts'}`);

  return parts.join(' · ');
}

export async function MyApplicationsWidget({
  userId,
}: MyApplicationsWidgetProps) {
  const [applications, counts] = await Promise.all([
    getRecentMyApplications(userId),
    getMyApplicationStatusCounts(userId),
  ]);

  const summary = buildCountsSummary(counts);

  return (
    // overflow-hidden clips the header hover highlight to the card's rounded corners
    <Card className="gap-0 overflow-hidden p-0">
      <CardHeader className="border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">
              My Applications
            </CardTitle>
            {summary && (
              <p className="text-muted-foreground mt-1 text-sm">{summary}</p>
            )}
          </div>
          <Link
            href="/my-applications"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
          >
            View all
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {applications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-muted-foreground text-sm">
              You haven&apos;t started any applications yet.
            </p>
            <Link
              href="/positions"
              className="text-primary text-sm font-medium hover:underline"
            >
              Browse positions
            </Link>
          </div>
        ) : (
          <CompactApplicationTable applications={applications} />
        )}
      </CardContent>
    </Card>
  );
}

function CompactApplicationTable({
  applications,
}: {
  applications: MyApplicationListItem[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Position</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Applied</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {applications.map((app) => (
          <TableRow key={app.id}>
            <TableCell>
              <Link
                href={`/positions/${app.positionId}`}
                className="font-medium hover:underline"
              >
                {app.position.title}
              </Link>
            </TableCell>
            <TableCell>
              <ApplicationStatusBadge status={app.status} />
            </TableCell>
            <TableCell className="text-muted-foreground">
              {app.status === 'draft' ? '—' : formatDate(app.submittedAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
