import {
  TEST_PREFIX,
  cleanupFixtures,
  createTestUser,
} from '@/tests/helpers/fixtures';
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

import { prisma } from '@/lib/prisma';

const mockSend = vi.fn();

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: (...args: unknown[]) => mockSend(...args) };
  },
}));

const { sendEmail } = await import('@/lib/email/resend');

function testAddress(): string {
  return `${TEST_PREFIX}${randomUUID()}@example.com`;
}

beforeAll(() => {
  vi.stubEnv('RESEND_API_KEY', 'test-key');
  vi.stubEnv('RESEND_FROM_EMAIL', 'noreply@example.com');
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await cleanupFixtures();
});

beforeEach(() => {
  mockSend.mockReset();
});

describe('sendEmail', () => {
  it('writes one sent row with the provider id on success', async () => {
    mockSend.mockResolvedValue({ data: { id: 'resend-msg-1' }, error: null });
    const to = testAddress();

    await sendEmail({
      to,
      subject: 'Subject',
      html: '<p>hi</p>',
      text: 'hi',
      template: 'otp',
    });

    const logs = await prisma.emailLog.findMany({ where: { to } });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.status).toBe('sent');
    expect(logs[0]?.providerMessageId).toBe('resend-msg-1');
    expect(logs[0]?.sentAt).not.toBeNull();
    expect(logs[0]?.userId).toBeNull();
  });

  it('writes one failed row and rethrows on a provider error response', async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: 'blocked', statusCode: 422, name: 'validation_error' },
    });
    const to = testAddress();

    await expect(
      sendEmail({
        to,
        subject: 'Subject',
        html: '<p>hi</p>',
        text: 'hi',
        template: 'otp',
      }),
    ).rejects.toThrow('blocked');

    const logs = await prisma.emailLog.findMany({ where: { to } });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.status).toBe('failed');
    expect(logs[0]?.error).toBe('blocked');
  });

  it('writes one failed row and rethrows on a thrown SDK error', async () => {
    mockSend.mockRejectedValue(new Error('network down'));
    const to = testAddress();

    await expect(
      sendEmail({
        to,
        subject: 'Subject',
        html: '<p>hi</p>',
        text: 'hi',
        template: 'otp',
      }),
    ).rejects.toThrow('Resend send failed');

    const logs = await prisma.emailLog.findMany({ where: { to } });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.status).toBe('failed');
    expect(logs[0]?.error).toBe('network down');
  });

  it('links userId when the recipient matches an existing user', async () => {
    const user = await createTestUser();
    mockSend.mockResolvedValue({ data: { id: 'resend-msg-2' }, error: null });

    await sendEmail({
      to: user.email,
      subject: 'Subject',
      html: '<p>hi</p>',
      text: 'hi',
      template: 'otp',
    });

    const log = await prisma.emailLog.findFirstOrThrow({
      where: { to: user.email },
    });
    expect(log.userId).toBe(user.id);
  });
});
