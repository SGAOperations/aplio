import type { Metadata } from 'next';
import { Suspense } from 'react';

import { z } from 'zod/v4';

import { requireAdminOr404 } from '@/lib/auth/guards';
import { EMAIL_STATUS_VALUES, EMAIL_TEMPLATE_VALUES } from '@/lib/constants';
import { STATE_ICONS } from '@/lib/icons';
import type { EmailLogFilters } from '@/lib/types';

import {
  EmailFailureStrip,
  EmailFailureStripSkeleton,
} from '@/components/features/email-failure-strip';
import { EmailLogResults } from '@/components/features/email-log-results';
import { EmailLogTableSkeleton } from '@/components/features/email-log-table-skeleton';
import { EmailLogToolbar } from '@/components/features/email-log-toolbar';
import { PageHeader } from '@/components/layouts/page-header';

export const metadata: Metadata = { title: 'Email Log' };

interface EmailsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const searchParamsSchema = z.object({
  q: z.string().trim().min(1).max(200).optional().catch(undefined),
  status: z.enum(EMAIL_STATUS_VALUES).optional().catch(undefined),
  template: z.enum(EMAIL_TEMPLATE_VALUES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

export default async function EmailsPage({ searchParams }: EmailsPageProps) {
  await requireAdminOr404();

  const sp = await searchParams;
  const parsed = searchParamsSchema.parse(sp);
  const page = parsed.page ?? 1;

  const filters: EmailLogFilters = {
    q: parsed.q,
    status: parsed.status,
    template: parsed.template,
  };

  const hasActiveFilters = !!(filters.q || filters.status || filters.template);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Email Log"
        description="Every email Aplio has attempted, and what happened to it."
      />

      <Suspense fallback={<EmailFailureStripSkeleton />}>
        <EmailFailureStrip />
      </Suspense>

      <EmailLogToolbar filters={filters} hasActiveFilters={hasActiveFilters} />

      <p className="text-muted-foreground flex items-start gap-2 text-sm">
        <STATE_ICONS.info className="mt-0.5 size-4 shrink-0" />
        Sent means Resend accepted the message — only Delivered confirms it
        reached the inbox. Newest first.
      </p>

      <Suspense
        key={JSON.stringify({ ...filters, page })}
        fallback={<EmailLogTableSkeleton />}
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
