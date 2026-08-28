import {
  TEST_PREFIX,
  answerAllRequiredGlobalQuestions,
  cleanupFixtures,
  createTestApplication,
  createTestPosition,
  createTestUser,
} from '@/tests/helpers/fixtures';
import { actAs } from '@/tests/stubs/auth-server';
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

import {
  submitApplication,
  updateApplicationStatus,
  updateApplicationStatuses,
  withdrawApplication,
} from '@/prisma/actions/applications';
import type { Position, User } from '@/prisma/client';
import { getDecisionEmailNotice } from '@/prisma/data/applications';

import { RESEND_BATCH_MAX_EMAILS } from '@/lib/constants';
import { prisma } from '@/lib/prisma';

const mockSend = vi.fn();
const mockCancel = vi.fn();
const mockBatchSend = vi.fn();

vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: (...args: unknown[]) => mockSend(...args),
      cancel: (...args: unknown[]) => mockCancel(...args),
    };
    batch = { send: (...args: unknown[]) => mockBatchSend(...args) };
  },
}));

const { afterCallbacks } = vi.hoisted(() => ({
  afterCallbacks: [] as Array<() => unknown>,
}));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    after: (task: () => unknown) => {
      afterCallbacks.push(task);
    },
  };
});

async function flushAfter(): Promise<void> {
  const tasks = afterCallbacks.splice(0);
  await Promise.all(tasks.map((task) => task()));
}

const { sendEmailBatch } = await import('@/lib/email/resend');

let admin: User;
let manager: User;
let position: Position;

beforeAll(async () => {
  vi.stubEnv('RESEND_API_KEY', 'test-key');
  vi.stubEnv('RESEND_FROM_EMAIL', 'noreply@example.com');
  admin = await createTestUser({ isAdmin: true });
  manager = await createTestUser();
  position = await createTestPosition(admin, { managers: [manager] });
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await cleanupFixtures();
});

beforeEach(() => {
  mockSend.mockReset();
  mockCancel.mockReset();
  mockBatchSend.mockReset();
  afterCallbacks.length = 0;
});

describe('single decision dispatch', () => {
  it('schedules exactly one email on a single accept', async () => {
    mockSend.mockResolvedValueOnce({
      data: { id: 'resend-scheduled-1' },
      error: null,
    });
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, position, {
      status: 'applied',
    });

    actAs(admin);
    const result = await updateApplicationStatus({
      applicationId: application.id,
      status: 'accepted',
    });
    expect(result).toBeUndefined();
    await flushAfter();

    const logs = await prisma.emailLog.findMany({
      where: { applicationId: application.id },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      status: 'scheduled',
      template: 'application_accepted',
      providerMessageId: 'resend-scheduled-1',
      applicationId: application.id,
    });
    expect(logs[0]?.scheduledAt).not.toBeNull();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('sends nothing for an in-group move', async () => {
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, position, {
      status: 'applied',
    });

    actAs(admin);
    await updateApplicationStatus({
      applicationId: application.id,
      status: 'reviewing',
    });
    await flushAfter();

    const logs = await prisma.emailLog.findMany({
      where: { applicationId: application.id },
    });
    expect(logs).toHaveLength(0);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('cancels the pending send when undone inside the window', async () => {
    mockSend.mockResolvedValueOnce({
      data: { id: 'resend-scheduled-2' },
      error: null,
    });
    mockCancel.mockResolvedValueOnce({
      data: { id: 'resend-scheduled-2' },
      error: null,
    });
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, position, {
      status: 'applied',
    });

    actAs(admin);
    await updateApplicationStatus({
      applicationId: application.id,
      status: 'accepted',
    });
    await flushAfter();

    await updateApplicationStatus({
      applicationId: application.id,
      status: 'reviewing',
    });
    await flushAfter();

    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockCancel).toHaveBeenCalledWith('resend-scheduled-2');

    const log = await prisma.emailLog.findFirstOrThrow({
      where: {
        applicationId: application.id,
        template: 'application_accepted',
      },
    });
    expect(log.status).toBe('cancelled');
  });

  it('leaves the row scheduled with an error when cancel fails, and does not throw', async () => {
    mockSend.mockResolvedValueOnce({
      data: { id: 'resend-scheduled-3' },
      error: null,
    });
    mockCancel.mockRejectedValueOnce(new Error('already delivered'));
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, position, {
      status: 'applied',
    });

    actAs(admin);
    await updateApplicationStatus({
      applicationId: application.id,
      status: 'accepted',
    });
    await flushAfter();

    await expect(
      updateApplicationStatus({
        applicationId: application.id,
        status: 'reviewing',
      }),
    ).resolves.toBeUndefined();
    await expect(flushAfter()).resolves.toBeUndefined();

    const log = await prisma.emailLog.findFirstOrThrow({
      where: {
        applicationId: application.id,
        template: 'application_accepted',
      },
    });
    expect(log.status).toBe('scheduled');
    expect(log.error).toBe('already delivered');
  });

  it('schedules exactly one live email through accept -> undo -> accept again', async () => {
    mockSend
      .mockResolvedValueOnce({
        data: { id: 'resend-scheduled-4a' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'resend-scheduled-4b' },
        error: null,
      });
    mockCancel.mockResolvedValueOnce({
      data: { id: 'resend-scheduled-4a' },
      error: null,
    });
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, position, {
      status: 'applied',
    });

    actAs(admin);
    await updateApplicationStatus({
      applicationId: application.id,
      status: 'accepted',
    });
    await flushAfter();

    await updateApplicationStatus({
      applicationId: application.id,
      status: 'reviewing',
    });
    await flushAfter();

    await updateApplicationStatus({
      applicationId: application.id,
      status: 'accepted',
    });
    await flushAfter();

    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockCancel).toHaveBeenCalledTimes(1);

    const logs = await prisma.emailLog.findMany({
      where: {
        applicationId: application.id,
        template: 'application_accepted',
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({
      status: 'cancelled',
      providerMessageId: 'resend-scheduled-4a',
    });
    expect(logs[1]).toMatchObject({
      status: 'scheduled',
      providerMessageId: 'resend-scheduled-4b',
    });
  });

  it('does not schedule a second email when the prior cancel fails, avoiding a double send', async () => {
    mockSend.mockResolvedValueOnce({
      data: { id: 'resend-scheduled-5' },
      error: null,
    });
    mockCancel.mockRejectedValue(new Error('already delivered'));
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, position, {
      status: 'applied',
    });

    actAs(admin);
    await updateApplicationStatus({
      applicationId: application.id,
      status: 'accepted',
    });
    await flushAfter();

    await updateApplicationStatus({
      applicationId: application.id,
      status: 'reviewing',
    });
    await flushAfter();

    await updateApplicationStatus({
      applicationId: application.id,
      status: 'accepted',
    });
    await flushAfter();

    // Only the original send — a second one would leave two live schedules
    // in Resend, exactly the bug this gate prevents.
    expect(mockSend).toHaveBeenCalledTimes(1);

    const logs = await prisma.emailLog.findMany({
      where: {
        applicationId: application.id,
        template: 'application_accepted',
      },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      status: 'scheduled',
      providerMessageId: 'resend-scheduled-5',
      error: 'already delivered',
    });
  });

  it('never schedules a second decision email once one has reached sent, even after flipping back and forth', async () => {
    mockSend.mockResolvedValueOnce({
      data: { id: 'resend-scheduled-6' },
      error: null,
    });
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, position, {
      status: 'applied',
    });

    actAs(admin);
    await updateApplicationStatus({
      applicationId: application.id,
      status: 'accepted',
    });
    await flushAfter();

    // Simulates the delivery webhook upgrading the row past `scheduled`.
    await prisma.emailLog.updateMany({
      where: {
        applicationId: application.id,
        template: 'application_accepted',
      },
      data: { status: 'delivered' },
    });

    await updateApplicationStatus({
      applicationId: application.id,
      status: 'reviewing',
    });
    await flushAfter();

    await updateApplicationStatus({
      applicationId: application.id,
      status: 'rejected',
      override: true,
    });
    await flushAfter();

    await updateApplicationStatus({
      applicationId: application.id,
      status: 'accepted',
      override: true,
    });
    await flushAfter();

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockCancel).not.toHaveBeenCalled();

    const logs = await prisma.emailLog.findMany({
      where: { applicationId: application.id },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.status).toBe('delivered');
  });

  it('commits the status change and writes failed when the provider rejects the send', async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { message: 'blocked', statusCode: 422, name: 'validation_error' },
    });
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, position, {
      status: 'applied',
    });

    actAs(admin);
    const result = await updateApplicationStatus({
      applicationId: application.id,
      status: 'accepted',
    });
    expect(result).toBeUndefined();
    await flushAfter();

    const updated = await prisma.application.findUniqueOrThrow({
      where: { id: application.id },
      select: { status: true },
    });
    expect(updated.status).toBe('accepted');

    const log = await prisma.emailLog.findFirstOrThrow({
      where: { applicationId: application.id },
    });
    expect(log.status).toBe('failed');
  });
});

describe('bulk decision dispatch', () => {
  it.each([
    ['admin' as const, () => admin],
    ['manager' as const, () => manager],
  ])(
    'bulk-accepts and writes one sent row per recipient as %s',
    async (_label, getCaller) => {
      mockBatchSend.mockImplementationOnce((payload: unknown[]) =>
        Promise.resolve({
          data: {
            data: payload.map((_, i) => ({ id: `batch-${i}` })),
            errors: [],
          },
          error: null,
        }),
      );

      const applicant1 = await createTestUser();
      const applicant2 = await createTestUser();
      const app1 = await createTestApplication(applicant1, position, {
        status: 'applied',
      });
      const app2 = await createTestApplication(applicant2, position, {
        status: 'reached_out',
      });

      actAs(getCaller());
      const result = await updateApplicationStatuses({
        applicationIds: [app1.id, app2.id],
        status: 'accepted',
      });
      expect(result).toEqual({ updated: 2, skipped: 0 });
      await flushAfter();

      expect(mockBatchSend).toHaveBeenCalledTimes(1);

      const logs = await prisma.emailLog.findMany({
        where: { applicationId: { in: [app1.id, app2.id] } },
      });
      expect(logs).toHaveLength(2);
      for (const log of logs) {
        expect(log.status).toBe('sent');
        expect(log.scheduledAt).toBeNull();
        expect(log.providerMessageId).not.toBeNull();
      }
      expect(new Set(logs.map((l) => l.providerMessageId))).toEqual(
        new Set(['batch-0', 'batch-1']),
      );
    },
  );

  it('skips a recipient whose decision email already reached sent, but still emails the rest', async () => {
    mockBatchSend.mockImplementationOnce((payload: unknown[]) =>
      Promise.resolve({
        data: {
          data: payload.map((_, i) => ({ id: `batch-skip-${i}` })),
          errors: [],
        },
        error: null,
      }),
    );

    const applicant1 = await createTestUser();
    const applicant2 = await createTestUser();
    const app1 = await createTestApplication(applicant1, position, {
      status: 'applied',
    });
    const app2 = await createTestApplication(applicant2, position, {
      status: 'applied',
    });

    // app1 already had a rejection delivered in an earlier round-trip.
    await prisma.emailLog.create({
      data: {
        to: applicant1.email,
        applicationId: app1.id,
        template: 'application_rejected',
        subject: 'Subject',
        status: 'delivered',
      },
    });

    actAs(admin);
    const result = await updateApplicationStatuses({
      applicationIds: [app1.id, app2.id],
      status: 'rejected',
    });
    expect(result).toEqual({ updated: 2, skipped: 0 });
    await flushAfter();

    expect(mockBatchSend).toHaveBeenCalledTimes(1);
    expect(mockBatchSend).toHaveBeenCalledWith(
      [expect.objectContaining({ to: applicant2.email })],
      expect.anything(),
    );

    const app1Logs = await prisma.emailLog.findMany({
      where: { applicationId: app1.id, template: 'application_rejected' },
    });
    expect(app1Logs).toHaveLength(1);
    expect(app1Logs[0]?.status).toBe('delivered');

    const app2Log = await prisma.emailLog.findFirstOrThrow({
      where: { applicationId: app2.id, template: 'application_rejected' },
    });
    expect(app2Log.status).toBe('sent');
  });

  it('chunks over RESEND_BATCH_MAX_EMAILS recipients into multiple batch.send calls', async () => {
    mockBatchSend.mockImplementation((payload: unknown[]) =>
      Promise.resolve({
        data: {
          data: payload.map((_, i) => ({ id: `chunk-${i}` })),
          errors: [],
        },
        error: null,
      }),
    );

    const entries = Array.from({ length: RESEND_BATCH_MAX_EMAILS + 1 }, () => ({
      to: `${TEST_PREFIX}${randomUUID()}@example.com`,
      subject: 'Subject',
      html: '<p>hi</p>',
      text: 'hi',
      template: 'application_accepted' as const,
    }));

    await sendEmailBatch(entries);

    expect(mockBatchSend).toHaveBeenCalledTimes(2);
  });

  it('writes one failed row per rejected index and sent rows for the rest, ids matched by position', async () => {
    mockBatchSend.mockResolvedValueOnce({
      data: {
        data: [{ id: 'ok-0' }, { id: 'ok-2' }],
        errors: [{ index: 1, message: 'invalid address' }],
      },
      error: null,
    });

    const entries = [0, 1, 2].map((i) => ({
      to: `${TEST_PREFIX}${randomUUID()}@example.com`,
      subject: `Subject ${i}`,
      html: '<p>hi</p>',
      text: 'hi',
      template: 'application_rejected' as const,
    }));

    await sendEmailBatch(entries);

    const logs = await prisma.emailLog.findMany({
      where: { to: { in: entries.map((e) => e.to) } },
      orderBy: { subject: 'asc' },
    });
    expect(logs).toHaveLength(3);
    expect(logs[0]).toMatchObject({
      status: 'sent',
      providerMessageId: 'ok-0',
    });
    expect(logs[1]).toMatchObject({
      status: 'failed',
      error: 'invalid address',
    });
    expect(logs[2]).toMatchObject({
      status: 'sent',
      providerMessageId: 'ok-2',
    });
  });
});

describe('submitApplication receipts', () => {
  it('writes one application_received row per submit and resubmit', async () => {
    mockSend.mockResolvedValue({ data: { id: 'resend-receipt' }, error: null });
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, position, {
      status: 'draft',
    });
    await answerAllRequiredGlobalQuestions(applicant);

    actAs(applicant);
    await submitApplication(application.id);
    await flushAfter();

    await withdrawApplication(application.id);
    await submitApplication(application.id);
    await flushAfter();

    const logs = await prisma.emailLog.findMany({
      where: {
        applicationId: application.id,
        template: 'application_received',
      },
    });
    expect(logs).toHaveLength(2);
  });
});

describe('getDecisionEmailNotice', () => {
  it('returns the real scheduledAt while a decision email is still pending', async () => {
    mockSend.mockResolvedValueOnce({
      data: { id: 'resend-notice-1' },
      error: null,
    });
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, position, {
      status: 'applied',
    });

    actAs(admin);
    await updateApplicationStatus({
      applicationId: application.id,
      status: 'accepted',
    });
    await flushAfter();

    const log = await prisma.emailLog.findFirstOrThrow({
      where: {
        applicationId: application.id,
        template: 'application_accepted',
      },
    });

    const notice = await getDecisionEmailNotice(
      application.id,
      'accepted',
      admin,
    );
    expect(notice).toEqual({
      status: 'scheduled',
      scheduledAt: log.scheduledAt,
    });
  });

  it('returns sent once the email is delivered, with no timestamp', async () => {
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, position, {
      status: 'rejected',
    });
    await prisma.emailLog.create({
      data: {
        to: applicant.email,
        applicationId: application.id,
        template: 'application_rejected',
        subject: 'Subject',
        status: 'delivered',
      },
    });

    const notice = await getDecisionEmailNotice(
      application.id,
      'rejected',
      admin,
    );
    expect(notice).toEqual({ status: 'sent' });
  });

  it('returns null once the pending send was cancelled', async () => {
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, position, {
      status: 'reviewing',
    });
    await prisma.emailLog.create({
      data: {
        to: applicant.email,
        applicationId: application.id,
        template: 'application_accepted',
        subject: 'Subject',
        status: 'cancelled',
      },
    });

    const notice = await getDecisionEmailNotice(
      application.id,
      'accepted',
      admin,
    );
    expect(notice).toBeNull();
  });

  it('returns null for a status with no decision email', async () => {
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, position, {
      status: 'reviewing',
    });

    const notice = await getDecisionEmailNotice(
      application.id,
      'reviewing',
      admin,
    );
    expect(notice).toBeNull();
  });
});
