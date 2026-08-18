import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getMyApplication } from '@/prisma/data/applications';

import { getCurrentUser } from '@/lib/auth/server';
import { formatDate } from '@/lib/utils';

import { ApplicationAnswersList } from '@/components/features/application-answers-list';
import { MyApplicationStatusCard } from '@/components/features/my-application-status-card';
import { PageHeader } from '@/components/layouts/page-header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface MyApplicationDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: MyApplicationDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const user = await getCurrentUser();
  const application = await getMyApplication(id, user.id);
  if (!application) return {};
  return { title: application.position.title };
}

export default async function MyApplicationDetailPage({
  params,
}: MyApplicationDetailPageProps) {
  const { id } = await params;
  const user = await getCurrentUser();

  const application = await getMyApplication(id, user.id);

  if (!application) notFound();

  const metaLine =
    application.status === 'draft'
      ? `Draft · last saved ${formatDate(application.updatedAt)}`
      : `Applied ${formatDate(application.submittedAt)}`;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <PageHeader
          title={application.position.title}
          backHref="/my-applications"
          backLabel="Back to My Applications"
        />
        <p className="text-muted-foreground mt-1 text-sm">
          {metaLine} ·{' '}
          <Link
            href={`/positions/${application.position.id}`}
            className="underline"
          >
            View position
          </Link>
        </p>
      </div>

      {/* Two-column layout at lg: Status panel sticky on right; answers on left */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: answers (lg:col-span-2) */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-base font-semibold">
                Your profile answers
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <ApplicationAnswersList
                answers={application.globalAnswers}
                emptyMessage="No profile answers saved yet."
                applicationId={application.id}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-base font-semibold">
                Your answers for this position
              </CardTitle>
              <CardDescription>{application.position.title}</CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <ApplicationAnswersList
                answers={application.positionAnswers}
                emptyMessage="No position answers saved yet."
                applicationId={application.id}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right: Status panel — sticky on lg, stacked first on mobile */}
        <div className="order-first lg:sticky lg:top-6 lg:order-none lg:self-start">
          <MyApplicationStatusCard application={application} />
        </div>
      </div>
    </div>
  );
}
