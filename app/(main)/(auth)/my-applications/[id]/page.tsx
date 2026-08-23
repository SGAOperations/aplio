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
      <div className="mb-4">
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

      {/* Two-column layout at lg: Progress panel sticky on right; answers on left */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: answers (lg:col-span-2) */}
        <div className="flex flex-col gap-4 lg:col-span-2">
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

        {/* Right: Progress panel — sticky on lg, stacked first on mobile */}
        <div className="order-first lg:sticky lg:top-6 lg:order-none lg:max-h-[calc(100svh-3rem)] lg:self-start lg:overflow-y-auto">
          <MyApplicationStatusCard application={application} />
        </div>
      </div>
    </div>
  );
}
