import 'server-only';

import type { Prisma } from '@/prisma/client';

import {
  EMAIL_FAILURE_STATUSES,
  EMAIL_FAILURE_WINDOW_DAYS,
  EMAIL_LOG_PAGE_SIZE,
} from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import type {
  EmailFailureCounts,
  EmailLogFilters,
  EmailLogListItem,
} from '@/lib/types';

const emailLogSelect = {
  id: true,
  to: true,
  subject: true,
  template: true,
  status: true,
  bounceType: true,
  error: true,
  scheduledAt: true,
  sentAt: true,
  deliveredAt: true,
  createdAt: true,
  user: { select: { id: true, name: true } },
} as const;

function buildEmailLogWhere(
  filters: EmailLogFilters,
): Prisma.EmailLogWhereInput {
  return {
    ...(filters.q ? { to: { contains: filters.q, mode: 'insensitive' } } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.template ? { template: filters.template } : {}),
  };
}

// Exposes recipient addresses and provider errors — admin-gated callers only.
export async function getEmailLogs(
  filters: EmailLogFilters,
  page = 1,
): Promise<EmailLogListItem[]> {
  return prisma.emailLog.findMany({
    where: buildEmailLogWhere(filters),
    select: emailLogSelect,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: EMAIL_LOG_PAGE_SIZE,
    skip: (page - 1) * EMAIL_LOG_PAGE_SIZE,
  });
}

// Must share buildEmailLogWhere with getEmailLogs — a count built from a
// different where would disagree with the page it's paginating.
export async function getEmailLogsCount(
  filters: EmailLogFilters,
): Promise<number> {
  return prisma.emailLog.count({ where: buildEmailLogWhere(filters) });
}

export async function getEmailFailureCounts(): Promise<EmailFailureCounts> {
  const windowStart = new Date(
    Date.now() - EMAIL_FAILURE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  const rows = await prisma.emailLog.groupBy({
    by: ['status'],
    where: {
      status: { in: EMAIL_FAILURE_STATUSES },
      createdAt: { gte: windowStart },
    },
    _count: { _all: true },
  });

  const counts = Object.fromEntries(
    EMAIL_FAILURE_STATUSES.map((status) => [status, 0]),
  ) as EmailFailureCounts;

  for (const row of rows)
    counts[row.status as (typeof EMAIL_FAILURE_STATUSES)[number]] =
      row._count._all;

  return counts;
}
