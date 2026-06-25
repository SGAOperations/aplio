import Link from 'next/link';

import { ArrowRight, Inbox } from 'lucide-react';

import { getRecentApplications } from '@/prisma/data/applications';

import { type AdminApplicationListItem } from '@/lib/types';
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

export async function RecentApplications() {
  const applications = await getRecentApplications();

  return (
    // overflow-hidden clips the header hover highlight to the card's rounded corners
    <Card className="gap-0 overflow-hidden p-0">
      <CardHeader className="border-b p-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Recent Applications
          </CardTitle>
          <Link
            href="/applications"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
          >
            View all
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {applications.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Inbox
              className="text-muted-foreground size-10"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium">No applications yet</p>
              <p className="text-muted-foreground mt-0.5 text-sm">
                Submissions across all positions will appear here.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Applied</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((app) => (
                    <ApplicationRow key={app.id} app={app} />
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile stacked cards */}
            <div className="flex flex-col divide-y md:hidden">
              {applications.map((app) => (
                <ApplicationCard key={app.id} app={app} />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ApplicationRow({ app }: { app: AdminApplicationListItem }) {
  const applicantLabel = app.user.name ?? app.user.email;

  return (
    <TableRow>
      <TableCell>
        <Link
          href={`/applications/${app.id}`}
          className="font-medium hover:underline"
        >
          {applicantLabel}
        </Link>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {app.position.title}
      </TableCell>
      <TableCell>
        <ApplicationStatusBadge status={app.status} />
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatDate(app.submittedAt)}
      </TableCell>
    </TableRow>
  );
}

function ApplicationCard({ app }: { app: AdminApplicationListItem }) {
  const applicantLabel = app.user.name ?? app.user.email;

  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/applications/${app.id}`}
          className="font-medium hover:underline"
        >
          {applicantLabel}
        </Link>
        <ApplicationStatusBadge status={app.status} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-sm">
          {app.position.title}
        </span>
        <span className="text-muted-foreground text-sm">
          {formatDate(app.submittedAt)}
        </span>
      </div>
    </div>
  );
}
