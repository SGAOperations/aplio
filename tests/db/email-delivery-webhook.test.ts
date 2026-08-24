import { TEST_PREFIX, cleanupFixtures } from '@/tests/helpers/fixtures';
import { randomUUID } from 'node:crypto';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { EmailLog } from '@/prisma/client';

import { prisma } from '@/lib/prisma';

let verifyImpl: (...args: unknown[]) => unknown;

vi.mock('resend', () => ({
  Resend: class {
    webhooks = { verify: (...args: unknown[]) => verifyImpl(...args) };
  },
}));

const { POST } = await import('@/app/api/webhooks/resend/route');

function testAddress(): string {
  return `${TEST_PREFIX}${randomUUID()}@example.com`;
}

async function seedSentRow(): Promise<EmailLog> {
  return prisma.emailLog.create({
    data: {
      to: testAddress(),
      template: 'otp',
      subject: 'Subject',
      status: 'sent',
      providerMessageId: randomUUID(),
    },
  });
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/webhooks/resend', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'svix-id': 'id-1',
      'svix-timestamp': String(Math.floor(Date.now() / 1000)),
      'svix-signature': 'v1,stub',
    },
  });
}

async function postEvent(payload: unknown): Promise<Response> {
  verifyImpl = () => payload;
  return POST(makeRequest(payload));
}

beforeAll(() => {
  vi.stubEnv('RESEND_API_KEY', 'test-key');
  vi.stubEnv('RESEND_WEBHOOK_SECRET', 'whsec_test');
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await cleanupFixtures();
});

beforeEach(() => {
  verifyImpl = () => {
    throw new Error('verifyImpl not stubbed for this call');
  };
});

describe('POST /api/webhooks/resend', () => {
  it('applies email.delivered to a seeded sent row', async () => {
    const row = await seedSentRow();

    const res = await postEvent({
      type: 'email.delivered',
      created_at: '2026-01-01T00:00:00.000Z',
      data: { email_id: row.providerMessageId },
    });

    expect(res.status).toBe(200);
    const updated = await prisma.emailLog.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(updated.status).toBe('delivered');
    expect(updated.deliveredAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
  });

  it('applies email.bounced to a seeded sent row', async () => {
    const row = await seedSentRow();

    const res = await postEvent({
      type: 'email.bounced',
      created_at: '2026-01-01T00:00:00.000Z',
      data: {
        email_id: row.providerMessageId,
        bounce: { type: 'Permanent', message: 'mailbox does not exist' },
      },
    });

    expect(res.status).toBe(200);
    const updated = await prisma.emailLog.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(updated.status).toBe('bounced');
    expect(updated.bounceType).toBe('Permanent');
    expect(updated.error).toBe('mailbox does not exist');
  });

  it('applies email.complained to a seeded sent row', async () => {
    const row = await seedSentRow();

    const res = await postEvent({
      type: 'email.complained',
      created_at: '2026-01-01T00:00:00.000Z',
      data: { email_id: row.providerMessageId },
    });

    expect(res.status).toBe(200);
    const updated = await prisma.emailLog.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(updated.status).toBe('complained');
  });

  it('applies email.suppressed to a seeded sent row', async () => {
    const row = await seedSentRow();

    const res = await postEvent({
      type: 'email.suppressed',
      created_at: '2026-01-01T00:00:00.000Z',
      data: {
        email_id: row.providerMessageId,
        suppressed: { message: 'known bounce' },
      },
    });

    expect(res.status).toBe(200);
    const updated = await prisma.emailLog.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(updated.status).toBe('suppressed');
    expect(updated.error).toBe('known bounce');
  });

  it('does not let a delivered event override an existing bounce', async () => {
    const row = await seedSentRow();

    await postEvent({
      type: 'email.bounced',
      created_at: '2026-01-01T00:00:00.000Z',
      data: {
        email_id: row.providerMessageId,
        bounce: { type: 'Permanent', message: 'mailbox does not exist' },
      },
    });
    await postEvent({
      type: 'email.delivered',
      created_at: '2026-01-01T00:05:00.000Z',
      data: { email_id: row.providerMessageId },
    });

    const updated = await prisma.emailLog.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(updated.status).toBe('bounced');
    expect(updated.deliveredAt).toBeNull();
  });

  it('applying the same delivered event twice writes once', async () => {
    const row = await seedSentRow();
    const event = {
      type: 'email.delivered',
      created_at: '2026-01-01T00:00:00.000Z',
      data: { email_id: row.providerMessageId },
    };

    const first = await postEvent(event);
    const second = await postEvent(event);

    expect(await first.json()).toEqual({ applied: 'delivered' });
    expect(await second.json()).toEqual({
      ignored: 'no matching row or already terminal',
    });
    const updated = await prisma.emailLog.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(updated.status).toBe('delivered');
  });

  it('returns 200 and writes nothing for an unknown email_id', async () => {
    const res = await postEvent({
      type: 'email.delivered',
      created_at: '2026-01-01T00:00:00.000Z',
      data: { email_id: randomUUID() },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ignored: 'no matching row or already terminal',
    });
  });

  it('returns 400 and writes nothing when signature verification throws', async () => {
    const row = await seedSentRow();
    verifyImpl = () => {
      throw new Error('bad signature');
    };

    const res = await POST(
      makeRequest({
        type: 'email.delivered',
        created_at: '2026-01-01T00:00:00.000Z',
        data: { email_id: row.providerMessageId },
      }),
    );

    expect(res.status).toBe(400);
    const untouched = await prisma.emailLog.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(untouched.status).toBe('sent');
  });

  it('ignores an unhandled event type and writes nothing', async () => {
    const row = await seedSentRow();

    const res = await postEvent({
      type: 'email.opened',
      created_at: '2026-01-01T00:00:00.000Z',
      data: { email_id: row.providerMessageId },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ignored: 'unhandled event type' });
    const untouched = await prisma.emailLog.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(untouched.status).toBe('sent');
  });
});
