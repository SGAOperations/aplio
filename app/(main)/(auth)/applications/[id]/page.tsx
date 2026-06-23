import { notFound } from 'next/navigation';

import { getApplicationForReview } from '@/prisma/data/applications';

import { getCurrentUser } from '@/lib/auth/server';
import { formatDate } from '@/lib/utils';

import { ApplicationAnswersList } from '@/components/features/application-answers-list';
import { ApplicationStatusControl } from '@/components/features/application-status-control';
import { ApplicationStatusBadge } from '@/components/features/status-badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface ApplicationDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ApplicationDetailPage({
  params,
}: ApplicationDetailPageProps) {
  const { id } = await params;
  const user = await getCurrentUser();

  const application = await getApplicationForReview(id, user);

  if (!application) notFound();

  const applicantName = application.user.name ?? application.user.email;
  const isDraft = application.status === 'draft';

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {applicantName}
        </h1>
        <p className="text-muted-foreground text-sm">
          {application.user.email}
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          {application.position.title}
          {isDraft ? (
            <span> · Draft — not yet submitted</span>
          ) : (
            <span> · Applied {formatDate(application.submittedAt)}</span>
          )}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-base font-semibold">Status</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ApplicationStatusBadge status={application.status} />
          <ApplicationStatusControl
            applicationId={application.id}
            currentStatus={application.status}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-base font-semibold">Profile answers</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ApplicationAnswersList
            answers={application.globalAnswers}
            emptyMessage="No profile answers."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-base font-semibold">Position answers</h2>
          </CardTitle>
          <CardDescription>{application.position.title}</CardDescription>
        </CardHeader>
        <CardContent>
          <ApplicationAnswersList
            answers={application.positionAnswers}
            emptyMessage="No position-specific answers."
          />
        </CardContent>
      </Card>
    </div>
  );
}
