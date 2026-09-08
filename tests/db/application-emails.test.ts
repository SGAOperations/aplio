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

import { RESEND_BATCH_MAX_EMAILS } from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { isError } from '@/lib/utils';

const mockSend = vi.fn();
const mockBatchSend = vi.fn();

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: (...args: unknown[]) => mockSend(...args) };
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

// Real by default (resolves immediately, see tests/stubs/delay.ts) — overridden
// per test below to pause dispatch mid-wait for the undo-races-the-send cases.
const mockDelay = vi.fn<(ms: number) => Promise<void>>(() => Promise.resolve());
vi.mock('@/lib/delay', () => ({ delay: (ms: number) => mockDelay(ms) }));

// Resolves once `delay()` has actually been called — i.e. every DB write
// before the wait (the scheduled row, the eligibility checks) has already
// happened — and returns a `release` to let the paused dispatch continue.
function pauseDelay(): { called: Promise<void>; release: () => void } {
  let notifyCalled: (() => void) | undefined;
  const called = new Promise<void>((resolve) => {
    notifyCalled = resolve;
  });
  let release: (() => void) | undefined;
  mockDelay.mockImplementationOnce(() => {
    notifyCalled?.();
    return new Promise<void>((resolve) => {
      release = resolve;
    });
  });
  return { called, release: () => release?.() };
}

const { sendScheduledEmailBatch } = await import('@/lib/email/resend');

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
  mockBatchSend.mockReset();
  mockDelay.mockReset();
  mockDelay.mockImplementation(() => Promise.resolve());
  afterCallbacks.length = 0;
});

describe('single decision dispatch', () => {
  it('writes the row scheduled immediately, then sends once the wait elapses', async () => {
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

    // Resend is only ever asked to send once the wait is over — not a
    // scheduled-send call, hence no scheduledAt argument reaching it.
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(
      expect.not.objectContaining({ scheduledAt: expect.anything() }),
    );

    const logs = await prisma.emailLog.findMany({
      where: { applicationId: application.id },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      status: 'sent',
      template: 'application_accepted',
      providerMessageId: 'resend-scheduled-1',
      applicationId: application.id,
    });
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

  it('cancels the pending send when undone inside the window, with no provider round-trip at all', async () => {
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, position, {
      status: 'applied',
    });

    const paused = pauseDelay();

    actAs(admin);
    await updateApplicationStatus({
      applicationId: application.id,
      status: 'accepted',
    });
    const firstDispatch = flushAfter();
    await paused.called;

    // Row is `scheduled` and Resend has never been contacted — undo during
    // this window is a pure DB flip, nothing to race.
    const midWait = await prisma.emailLog.findFirstOrThrow({
      where: {
        applicationId: application.id,
        template: 'application_accepted',
      },
    });
    expect(midWait.status).toBe('scheduled');
    expect(midWait.providerMessageId).toBeNull();

    await updateApplicationStatus({
      applicationId: application.id,
      status: 'reviewing',
      override: true,
    });
    await flushAfter();

    paused.release();
    await firstDispatch;

    expect(mockSend).not.toHaveBeenCalled();

    const log = await prisma.emailLog.findFirstOrThrow({
      where: {
        applicationId: application.id,
        template: 'application_accepted',
      },
    });
    expect(log.status).toBe('cancelled');
    expect(log.providerMessageId).toBeNull();
  });

  it('schedules exactly one live email through accept -> undo (inside window) -> accept again', async () => {
    mockSend.mockResolvedValueOnce({
      data: { id: 'resend-scheduled-4b' },
      error: null,
    });
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, position, {
      status: 'applied',
    });

    const paused = pauseDelay();

    actAs(admin);
    await updateApplicationStatus({
      applicationId: application.id,
      status: 'accepted',
    });
    const firstDispatch = flushAfter();
    await paused.called;

    await updateApplicationStatus({
      applicationId: application.id,
      status: 'reviewing',
      override: true,
    });
    await flushAfter();

    paused.release();
    await firstDispatch;

    await updateApplicationStatus({
      applicationId: application.id,
      status: 'accepted',
    });
    await flushAfter();

    // Only the second accept ever reaches Resend — the cancelled one never did.
    expect(mockSend).toHaveBeenCalledTimes(1);

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
      providerMessageId: null,
    });
    expect(logs[1]).toMatchObject({
      status: 'sent',
      providerMessageId: 'resend-scheduled-4b',
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

    // Simulates the delivery webhook upgrading the row past `sent`.
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
      if (isError(result)) throw new Error('expected success');
      expect(result.updated).toBe(2);
      expect(result.skipped).toBe(0);
      await flushAfter();

      expect(mockBatchSend).toHaveBeenCalledTimes(1);

      const logs = await prisma.emailLog.findMany({
        where: { applicationId: { in: [app1.id, app2.id] } },
      });
      expect(logs).toHaveLength(2);
      for (const log of logs) {
        expect(log.status).toBe('sent');
        expect(log.providerMessageId).not.toBeNull();
      }
      expect(new Set(logs.map((l) => l.providerMessageId))).toEqual(
        new Set(['batch-0', 'batch-1']),
      );
    },
  );

  it('cancels a bulk-scheduled send undone inside the window, with no provider round-trip', async () => {
    const applicant1 = await createTestUser();
    const applicant2 = await createTestUser();
    const app1 = await createTestApplication(applicant1, position, {
      status: 'applied',
    });
    const app2 = await createTestApplication(applicant2, position, {
      status: 'applied',
    });

    const paused = pauseDelay();

    actAs(admin);
    const result = await updateApplicationStatuses({
      applicationIds: [app1.id, app2.id],
      status: 'accepted',
    });
    if (isError(result)) throw new Error('expected success');
    const bulkDispatch = flushAfter();
    await paused.called;

    // Undo everything before the wait elapses — same single-move action per
    // row, using the reversions the bulk action returned.
    await Promise.all(
      result.reversions.map((r) =>
        updateApplicationStatus({
          applicationId: r.applicationId,
          status: r.status,
          override: true,
        }),
      ),
    );
    await flushAfter();

    paused.release();
    await bulkDispatch;

    expect(mockBatchSend).not.toHaveBeenCalled();

    const logs = await prisma.emailLog.findMany({
      where: { applicationId: { in: [app1.id, app2.id] } },
    });
    expect(logs).toHaveLength(2);
    for (const log of logs) {
      expect(log.status).toBe('cancelled');
      expect(log.providerMessageId).toBeNull();
    }
  });

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
    if (isError(result)) throw new Error('expected success');
    expect(result.updated).toBe(2);
    expect(result.skipped).toBe(0);
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

    const rows = await Promise.all(
      Array.from({ length: RESEND_BATCH_MAX_EMAILS + 1 }, () =>
        prisma.emailLog.create({
          data: {
            to: `${TEST_PREFIX}${randomUUID()}@example.com`,
            template: 'application_accepted',
            subject: 'Subject',
            status: 'scheduled',
          },
        }),
      ),
    );
    const entries = rows.map((row) => ({
      logId: row.id,
      to: row.to,
      subject: 'Subject',
      html: '<p>hi</p>',
      text: 'hi',
    }));

    await sendScheduledEmailBatch(entries);

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

    const rows = await Promise.all(
      [0, 1, 2].map((i) =>
        prisma.emailLog.create({
          data: {
            to: `${TEST_PREFIX}${randomUUID()}@example.com`,
            template: 'application_rejected',
            subject: `Subject ${i}`,
            status: 'scheduled',
          },
        }),
      ),
    );
    const entries = rows.map((row, i) => ({
      logId: row.id,
      to: row.to,
      subject: `Subject ${i}`,
      html: '<p>hi</p>',
      text: 'hi',
    }));

    await sendScheduledEmailBatch(entries);

    const logs = await prisma.emailLog.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
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
