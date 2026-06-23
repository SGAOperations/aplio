import Link from 'next/link';

import { FileText } from 'lucide-react';

import { type MyApplicationListItem } from '@/lib/types';
import { formatDate } from '@/lib/utils';

import { MyApplicationRowActions } from '@/components/features/my-application-row-actions';
import { ApplicationStatusBadge } from '@/components/features/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface MyApplicationsTableProps {
  applications: MyApplicationListItem[];
}

export function MyApplicationsTable({
  applications,
}: MyApplicationsTableProps) {
  if (applications.length === 0)
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <FileText
            className="text-muted-foreground size-12"
            aria-hidden="true"
          />
          <div>
            <p className="text-base font-semibold">No applications yet</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Browse open positions to start your first application.
            </p>
          </div>
          <Button asChild>
            <Link href="/positions">Browse positions</Link>
          </Button>
        </CardContent>
      </Card>
    );

  return (
    <Card className="gap-0 p-0">
      {/* Desktop table — hidden on mobile */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Position</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Applied</TableHead>
              <TableHead>Action</TableHead>
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
                <TableCell>
                  <div className="flex items-center gap-2">
                    {app.status === 'draft' && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/positions/${app.positionId}/apply`}>
                          Continue
                        </Link>
                      </Button>
                    )}
                    <MyApplicationRowActions
                      applicationId={app.id}
                      status={app.status}
                      positionTitle={app.position.title}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile stacked cards — shown only on mobile */}
      <div className="flex flex-col divide-y md:hidden">
        {applications.map((app) => (
          <div key={app.id} className="flex flex-col gap-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/positions/${app.positionId}`}
                className="font-medium hover:underline"
              >
                {app.position.title}
              </Link>
              <ApplicationStatusBadge status={app.status} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-sm">
                {app.status === 'draft' ? 'Draft' : formatDate(app.submittedAt)}
              </span>
              <div className="flex items-center gap-2">
                {app.status === 'draft' && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/positions/${app.positionId}/apply`}>
                      Continue
                    </Link>
                  </Button>
                )}
                <MyApplicationRowActions
                  applicationId={app.id}
                  status={app.status}
                  positionTitle={app.position.title}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
