import type { Metadata } from 'next';
import { Suspense } from 'react';

import { requireAdminOr404 } from '@/lib/auth/guards';
import { STATE_ICONS } from '@/lib/icons';
import { loadEmailLogSearchParams } from '@/lib/search-params';
import type { EmailLogFilters } from '@/lib/types';

import {
  EmailFailureStrip,
  EmailFailureStripSkeleton,
} from '@/components/features/email-failure-strip';
import {
  EmailLogResults,
  EmailLogResultsSkeleton,
} from '@/components/features/email-log-results';
import { EmailLogToolbar } from '@/components/features/email-log-toolbar';
import { PageHeader } from '@/components/layouts/page-header';

export const metadata: Metadata = { title: 'Email Log' };

interface EmailsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function EmailsPage({ searchParams }: EmailsPageProps) {
  await requireAdminOr404();

  const parsed = await loadEmailLogSearchParams(searchParams);
  const page = parsed.page;

  const filters: EmailLogFilters = {
    q: parsed.q ?? undefined,
    statuses: parsed.statuses,
    templates: parsed.templates,
  };

  const hasActiveFilters = !!(
    filters.q ||
    filters.statuses?.length ||
    filters.templates?.length
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Email Log"
        description="Every email Aplio has attempted, and what happened to it."
      />

      <Suspense fallback={<EmailFailureStripSkeleton />}>
        <EmailFailureStrip />
      </Suspense>

      <EmailLogToolbar hasActiveFilters={hasActiveFilters} />

      <p className="text-muted-foreground flex items-start gap-2 text-sm">
        <STATE_ICONS.info className="mt-0.5 size-4 shrink-0" />
        Sent means Resend accepted the message — only Delivered confirms it
        reached the inbox. Newest first.
      </p>

      <Suspense
        key={JSON.stringify({ ...filters, page })}
        fallback={<EmailLogResultsSkeleton />}
      >
        <EmailLogResults
          filters={filters}
          page={page}
          hasActiveFilters={hasActiveFilters}
        />
      </Suspense>
    </div>
  );
}
