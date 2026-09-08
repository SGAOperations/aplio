import { TEST_PREFIX, cleanupFixtures } from '@/tests/helpers/fixtures';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';

import type { Prisma } from '@/prisma/client';
import {
  getEmailFailureCounts,
  getEmailLogs,
  getEmailLogsCount,
} from '@/prisma/data/emails';

import { EMAIL_LOG_PAGE_SIZE } from '@/lib/constants';
import { prisma } from '@/lib/prisma';

function testAddress(): string {
  return `${TEST_PREFIX}${randomUUID()}@example.com`;
}

async function seedRow(
  overrides: Partial<Prisma.EmailLogUncheckedCreateInput> = {},
) {
  return prisma.emailLog.create({
    data: {
      to: testAddress(),
      template: 'otp',
      subject: 'Subject',
      status: 'sent',
      ...overrides,
    },
  });
}

afterAll(async () => {
  await cleanupFixtures();
});

describe('getEmailLogs / getEmailLogsCount filtering', () => {
  it('recipient search is a case-insensitive partial match', async () => {
    const marker = randomUUID();
    const to = `${TEST_PREFIX}${marker}@example.com`;
    await seedRow({ to });
    await seedRow();

    const rows = await getEmailLogs({ q: marker.toUpperCase() });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.to).toBe(to);

    const count = await getEmailLogsCount({ q: marker.toUpperCase() });
    expect(count).toBe(1);
  });

  it('excludes non-matching addresses', async () => {
    const marker = randomUUID();
    await seedRow({ to: `${TEST_PREFIX}${marker}@example.com` });

    const rows = await getEmailLogs({ q: randomUUID() });
    expect(rows.some((r) => r.to.includes(marker))).toBe(false);
  });

  it('the status filter narrows correctly', async () => {
    const marker = randomUUID();
    await seedRow({
      to: `${TEST_PREFIX}${marker}-bounced@example.com`,
      status: 'bounced',
    });
    await seedRow({
      to: `${TEST_PREFIX}${marker}-sent@example.com`,
      status: 'sent',
    });

    const rows = await getEmailLogs({ q: marker, status: 'bounced' });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('bounced');
  });

  it('the template filter narrows correctly', async () => {
    const marker = randomUUID();
    await seedRow({
      to: `${TEST_PREFIX}${marker}-otp@example.com`,
      template: 'otp',
    });
    await seedRow({
      to: `${TEST_PREFIX}${marker}-digest@example.com`,
      template: 'manager_digest',
    });

    const rows = await getEmailLogs({ q: marker, template: 'manager_digest' });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.template).toBe('manager_digest');
  });

  it('status and template filters compose', async () => {
    const marker = randomUUID();
    await seedRow({
      to: `${TEST_PREFIX}${marker}-match@example.com`,
      status: 'bounced',
      template: 'otp',
    });
    await seedRow({
      to: `${TEST_PREFIX}${marker}-wrong-template@example.com`,
      status: 'bounced',
      template: 'manager_digest',
    });
    await seedRow({
      to: `${TEST_PREFIX}${marker}-wrong-status@example.com`,
      status: 'sent',
      template: 'otp',
    });

    const rows = await getEmailLogs({
      q: marker,
      status: 'bounced',
      template: 'otp',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.to).toBe(`${TEST_PREFIX}${marker}-match@example.com`);
  });

  it('getEmailLogsCount agrees with getEmailLogs over the same filters', async () => {
    const marker = randomUUID();
    for (let i = 0; i < 3; i++)
      await seedRow({ to: `${TEST_PREFIX}${marker}-${i}@example.com` });

    const rows = await getEmailLogs({ q: marker });
    const count = await getEmailLogsCount({ q: marker });
    expect(count).toBe(rows.length);
    expect(count).toBe(3);
  });

  it('orders strictly newest-first across a page boundary with no overlap', async () => {
    const marker = randomUUID();
    const total = EMAIL_LOG_PAGE_SIZE + 5;
    for (let i = 0; i < total; i++) {
      await seedRow({ to: `${TEST_PREFIX}${marker}-${i}@example.com` });
    }

    const page1 = await getEmailLogs({ q: marker }, 1);
    const page2 = await getEmailLogs({ q: marker }, 2);

    expect(page1).toHaveLength(EMAIL_LOG_PAGE_SIZE);
    expect(page2).toHaveLength(5);

    const page1Ids = new Set(page1.map((r) => r.id));
    const page2Ids = new Set(page2.map((r) => r.id));
    expect([...page1Ids].some((id) => page2Ids.has(id))).toBe(false);

    const allRows = [...page1, ...page2];
    for (let i = 1; i < allRows.length; i++) {
      const prev = allRows[i - 1]!;
      const curr = allRows[i]!;
      expect(prev.createdAt.getTime()).toBeGreaterThanOrEqual(
        curr.createdAt.getTime(),
      );
    }
  });
});

describe('getEmailFailureCounts', () => {
  it('counts only the three failure statuses inside the window, with explicit zeros outside', async () => {
    const before = await getEmailFailureCounts();

    await seedRow({ status: 'bounced' });
    await seedRow({ status: 'complained' });
    await seedRow({ status: 'failed' });
    // Not a failure status — must not bump any count.
    await seedRow({ status: 'sent' });
    // Outside the 7-day window — must not bump any count.
    await seedRow({
      status: 'bounced',
      createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    });

    const after = await getEmailFailureCounts();

    expect(after.bounced).toBe(before.bounced + 1);
    expect(after.complained).toBe(before.complained + 1);
    expect(after.failed).toBe(before.failed + 1);
  });

  it('returns explicit zeros when nothing has failed', async () => {
    await cleanupFixtures();
    const counts = await getEmailFailureCounts();
    expect(counts).toEqual({ bounced: 0, complained: 0, failed: 0 });
  });
});
