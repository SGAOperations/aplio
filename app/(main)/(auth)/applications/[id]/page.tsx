import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getApplicationForReview } from '@/prisma/data/applications';

import { getCurrentUser } from '@/lib/auth/server';
import { formatDate } from '@/lib/utils';

import { ApplicationAnswersList } from '@/components/features/application-answers-list';
import { ApplicationStatusControl } from '@/components/features/application-status-control';
import { ApplicationStatusBadge } from '@/components/features/status-badge';
import { PageHeader } from '@/components/layouts/page-header';
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

export async function generateMetadata({
  params,
}: ApplicationDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const user = await getCurrentUser();
  const application = await getApplicationForReview(id, user);
  if (!application) return {};
  return { title: application.user.name ?? application.user.email };
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
  const metaLine = isDraft
    ? `${application.position.title} · Draft — not yet submitted`
    : `${application.position.title} · Applied ${formatDate(application.submittedAt)}`;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <PageHeader
          title={applicantName}
          description={application.user.email}
        />
        <p className="text-muted-foreground mt-1 text-sm">{metaLine}</p>
      </div>

      {/* Two-column layout at lg: Status panel sticky on right; answers on left */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: answers (lg:col-span-2) */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-base font-semibold">
                Profile answers
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <ApplicationAnswersList
                answers={application.globalAnswers}
                emptyMessage="No profile answers."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-base font-semibold">
                Position answers
              </CardTitle>
              <CardDescription>{application.position.title}</CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <ApplicationAnswersList
                answers={application.positionAnswers}
                emptyMessage="No position-specific answers."
              />
            </CardContent>
          </Card>
        </div>

        {/* Right: Status panel — sticky on lg, stacked first on mobile */}
        <div className="order-first lg:sticky lg:top-6 lg:order-none lg:self-start">
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-base font-semibold">Status</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 p-3 pt-0">
              <ApplicationStatusBadge status={application.status} />
              <ApplicationStatusControl
                applicationId={application.id}
                currentStatus={application.status}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
