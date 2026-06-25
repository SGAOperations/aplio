import { Inbox } from 'lucide-react';

import { type PositionApplicationListItem } from '@/lib/types';
import { formatDate } from '@/lib/utils';

import { ApplicationStatusControl } from '@/components/features/application-status-control';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface PositionApplicationsTableProps {
  applications: PositionApplicationListItem[];
}

export function PositionApplicationsTable({
  applications,
}: PositionApplicationsTableProps) {
  if (applications.length === 0)
    return (
      <EmptyState
        icon={Inbox}
        title="No applications yet"
        description="Applications will appear here once candidates apply to this position."
      />
    );

  return (
    <Card className="gap-0 p-0">
      {/* Desktop table — hidden on mobile */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Applicant</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.map((app) => {
              const displayName = app.user.name ?? app.user.email;
              return (
                <TableRow key={app.id}>
                  <TableCell>
                    <span className="font-medium">{displayName}</span>
                    {app.user.name && (
                      <span className="text-muted-foreground block text-xs">
                        {app.user.email}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(app.submittedAt)}
                  </TableCell>
                  <TableCell>
                    <ApplicationStatusControl
                      applicationId={app.id}
                      currentStatus={app.status}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile stacked cards — shown only on mobile */}
      <div className="flex flex-col divide-y md:hidden">
        {applications.map((app) => {
          const displayName = app.user.name ?? app.user.email;
          return (
            <div key={app.id} className="flex flex-col gap-2 p-4">
              <div>
                <span className="font-medium">{displayName}</span>
                {app.user.name && (
                  <span className="text-muted-foreground block text-xs">
                    {app.user.email}
                  </span>
                )}
              </div>
              <span className="text-muted-foreground text-sm">
                {formatDate(app.submittedAt)}
              </span>
              <ApplicationStatusControl
                applicationId={app.id}
                currentStatus={app.status}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
