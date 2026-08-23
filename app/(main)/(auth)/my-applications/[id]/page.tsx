import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getMyApplication } from '@/prisma/data/applications';

import { getCurrentUser } from '@/lib/auth/server';

import { ApplicationAnswersList } from '@/components/features/application-answers-list';
import { MyApplicationStatusCard } from '@/components/features/my-application-status-card';
import { PageHeader } from '@/components/layouts/page-header';
import { LocalTime } from '@/components/ui/local-time';
import { SectionCard } from '@/components/ui/section-card';

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

  const isDraft = application.status === 'draft';

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header row: position info on left, compact Progress panel on right */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <PageHeader
            title={application.position.title}
            backHref="/my-applications"
            backLabel="Back to My Applications"
          />
          <p className="text-muted-foreground mt-1 text-sm">
            {isDraft ? 'Draft · last saved ' : 'Applied '}
            <LocalTime
              date={isDraft ? application.updatedAt : application.submittedAt}
              precision="date"
            />{' '}
            ·{' '}
            <Link
              href={`/positions/${application.position.id}`}
              className="underline"
            >
              View position
            </Link>
          </p>
        </div>

        <div className="lg:w-72 lg:shrink-0">
          <MyApplicationStatusCard application={application} />
        </div>
      </div>

      {/* Answers: full-width below the header */}
      <div className="flex flex-col gap-4">
        <SectionCard title="Your profile answers" titleAs="h2">
          <ApplicationAnswersList
            answers={application.globalAnswers}
            emptyMessage="No profile answers saved yet."
            applicationId={application.id}
          />
        </SectionCard>

        <SectionCard title="Your answers for this position" titleAs="h2">
          <ApplicationAnswersList
            answers={application.positionAnswers}
            emptyMessage="No position answers saved yet."
            applicationId={application.id}
          />
        </SectionCard>
      </div>
    </div>
  );
}
