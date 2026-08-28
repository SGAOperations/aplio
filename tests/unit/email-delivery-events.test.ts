import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { EmailStatus } from '@/prisma/client';

import {
  deliveryEventSchema,
  statusesBelow,
  toDeliveryUpdate,
  verifyResendWebhook,
} from '@/lib/email/delivery-events';

const SECRET = `whsec_${Buffer.from('unit-test-webhook-secret').toString('base64')}`;

function signWebhook(id: string, timestamp: string, body: string): string {
  const key = Buffer.from(SECRET.slice('whsec_'.length), 'base64');
  const signature = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64');
  return `v1,${signature}`;
}

function signedHeaders(
  id: string,
  timestamp: string,
  signature: string,
): Headers {
  return new Headers({
    'svix-id': id,
    'svix-timestamp': timestamp,
    'svix-signature': signature,
  });
}

beforeAll(() => {
  vi.stubEnv('RESEND_API_KEY', 'test-key');
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe('verifyResendWebhook', () => {
  it('returns the parsed payload for a valid signature', () => {
    const id = 'msg_1';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({ type: 'email.delivered' });
    const signature = signWebhook(id, timestamp, body);

    const result = verifyResendWebhook({
      rawBody: body,
      headers: signedHeaders(id, timestamp, signature),
      secret: SECRET,
    });

    expect(result).toEqual({ type: 'email.delivered' });
  });

  it('returns null for a tampered body', () => {
    const id = 'msg_2';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({ type: 'email.delivered' });
    const signature = signWebhook(id, timestamp, body);
    const tamperedBody = JSON.stringify({ type: 'email.delivereX' });

    const result = verifyResendWebhook({
      rawBody: tamperedBody,
      headers: signedHeaders(id, timestamp, signature),
      secret: SECRET,
    });

    expect(result).toBeNull();
  });

  it('returns null when a required header is missing', () => {
    const id = 'msg_3';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({ type: 'email.delivered' });

    const headers = new Headers({
      'svix-id': id,
      'svix-timestamp': timestamp,
      // svix-signature intentionally omitted
    });

    const result = verifyResendWebhook({
      rawBody: body,
      headers,
      secret: SECRET,
    });

    expect(result).toBeNull();
  });

  it('returns null for a stale timestamp', () => {
    const id = 'msg_4';
    const staleTimestamp = (Math.floor(Date.now() / 1000) - 600).toString();
    const body = JSON.stringify({ type: 'email.delivered' });
    const signature = signWebhook(id, staleTimestamp, body);

    const result = verifyResendWebhook({
      rawBody: body,
      headers: signedHeaders(id, staleTimestamp, signature),
      secret: SECRET,
    });

    expect(result).toBeNull();
  });
});

describe('toDeliveryUpdate', () => {
  it('maps email.delivered to delivered with deliveredAt from created_at', () => {
    const update = toDeliveryUpdate({
      type: 'email.delivered',
      created_at: '2026-01-01T00:00:00.000Z',
      data: { email_id: 'email_1' },
    });

    expect(update).toEqual({
      emailId: 'email_1',
      status: EmailStatus.delivered,
      fields: { deliveredAt: new Date('2026-01-01T00:00:00.000Z') },
    });
  });

  it('maps email.bounced to bounced with bounceType and error', () => {
    const update = toDeliveryUpdate({
      type: 'email.bounced',
      created_at: '2026-01-01T00:00:00.000Z',
      data: {
        email_id: 'email_2',
        bounce: { type: 'Permanent', message: 'mailbox does not exist' },
      },
    });

    expect(update).toEqual({
      emailId: 'email_2',
      status: EmailStatus.bounced,
      fields: { bounceType: 'Permanent', error: 'mailbox does not exist' },
    });
  });

  it('maps email.complained to complained with no extra fields', () => {
    const update = toDeliveryUpdate({
      type: 'email.complained',
      created_at: '2026-01-01T00:00:00.000Z',
      data: { email_id: 'email_3' },
    });

    expect(update).toEqual({
      emailId: 'email_3',
      status: EmailStatus.complained,
      fields: {},
    });
  });

  it('maps email.suppressed to suppressed with error from the suppression message', () => {
    const update = toDeliveryUpdate({
      type: 'email.suppressed',
      created_at: '2026-01-01T00:00:00.000Z',
      data: { email_id: 'email_4', suppressed: { message: 'known bounce' } },
    });

    expect(update).toEqual({
      emailId: 'email_4',
      status: EmailStatus.suppressed,
      fields: { error: 'known bounce' },
    });
  });
});

describe('deliveryEventSchema', () => {
  it('rejects an email.bounced payload missing bounce.type', () => {
    const result = deliveryEventSchema.safeParse({
      type: 'email.bounced',
      created_at: '2026-01-01T00:00:00.000Z',
      data: { email_id: 'email_5', bounce: { message: 'boom' } },
    });

    expect(result.success).toBe(false);
  });
});

describe('statusesBelow', () => {
  it('excludes terminal negative statuses below delivered', () => {
    const below = statusesBelow(EmailStatus.delivered);
    expect(below).not.toContain(EmailStatus.bounced);
    expect(below).not.toContain(EmailStatus.complained);
    expect(below).not.toContain(EmailStatus.suppressed);
  });

  it('includes sent and delivered below bounced', () => {
    const below = statusesBelow(EmailStatus.bounced);
    expect(below).toContain(EmailStatus.sent);
    expect(below).toContain(EmailStatus.delivered);
  });

  it('never includes a status in its own list', () => {
    for (const status of Object.values(EmailStatus))
      expect(statusesBelow(status)).not.toContain(status);
  });
});
