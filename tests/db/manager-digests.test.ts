import {
  TEST_PREFIX,
  cleanupFixtures,
  createTestApplication,
  createTestPosition,
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

import type { Position, User } from '@/prisma/client';

import {
  orgDayStart,
  previousOrgDay,
  previousOrgWeek,
  toOrgDayString,
} from '@/lib/dates';
import { prisma } from '@/lib/prisma';

const mockSend = vi.fn();

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: (...args: unknown[]) => mockSend(...args) };
  },
}));

const { GET: dailyGET } =
  await import('@/app/api/cron/manager-daily-digest/route');
const { GET: weeklyGET } =
  await import('@/app/api/cron/manager-weekly-digest/route');

const DAILY_URL = 'http://localhost/api/cron/manager-daily-digest';
const WEEKLY_URL = 'http://localhost/api/cron/manager-weekly-digest';
const CRON_SECRET = 'test-cron-secret';

function makeRequest(url: string, authorization?: string): Request {
  return new Request(url, { headers: authorization ? { authorization } : {} });
}

function sentTo(
  email: string,
): { to: string; subject: string; html: string } | undefined {
  return mockSend.mock.calls
    .map(([args]) => args as { to: string; subject: string; html: string })
    .find((args) => args.to === email);
}

let creator: User;

beforeAll(async () => {
  vi.stubEnv('RESEND_API_KEY', 'test-key');
  vi.stubEnv('RESEND_FROM_EMAIL', 'noreply@example.com');
  vi.stubEnv('CRON_SECRET', CRON_SECRET);
  creator = await createTestUser({ isAdmin: true });
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await cleanupFixtures();
});

beforeEach(() => {
  mockSend.mockReset();
  mockSend.mockResolvedValue({ data: { id: randomUUID() }, error: null });
});

describe('cron authorization', () => {
  it('rejects a request with no Authorization header on both routes', async () => {
    const dailyRes = await dailyGET(makeRequest(DAILY_URL));
    expect(dailyRes.status).toBe(401);
    expect(await dailyRes.json()).toEqual({ error: 'Unauthorized' });

    const weeklyRes = await weeklyGET(makeRequest(WEEKLY_URL));
    expect(weeklyRes.status).toBe(401);
    expect(await weeklyRes.json()).toEqual({ error: 'Unauthorized' });

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('rejects a request with the wrong bearer token on both routes', async () => {
    const dailyRes = await dailyGET(makeRequest(DAILY_URL, 'Bearer wrong'));
    expect(dailyRes.status).toBe(401);

    const weeklyRes = await weeklyGET(makeRequest(WEEKLY_URL, 'Bearer wrong'));
    expect(weeklyRes.status).toBe(401);

    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe('daily digest', () => {
  let manager: User;
  let position1: Position;
  let position2: Position;

  beforeEach(async () => {
    manager = await createTestUser();
    position1 = await createTestPosition(creator, { managers: [manager] });
    position2 = await createTestPosition(creator, { managers: [manager] });
  });

  it('sends one email covering two positions submitted yesterday, logged once', async () => {
    const yesterday = previousOrgDay(new Date());
    const submittedAt = new Date(yesterday.start.getTime() + 60 * 60 * 1000);

    const applicantA = await createTestUser();
    const applicantB = await createTestUser();
    await createTestApplication(applicantA, position1, { submittedAt });
    await createTestApplication(applicantB, position1, { submittedAt });
    await createTestApplication(applicantA, position2, { submittedAt });

    const res = await dailyGET(makeRequest(DAILY_URL, `Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);

    const call = sentTo(manager.email);
    expect(call).toBeDefined();
    expect(call?.subject).toBe('3 new applications across 2 positions');
    expect(call?.html).toContain(`?positionId=${position1.id}`);
    expect(call?.html).toContain(`?positionId=${position2.id}`);

    const logs = await prisma.emailLog.findMany({
      where: { userId: manager.id, template: 'manager_daily_digest' },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.applicationId).toBeNull();
  });

  it('excludes submissions from today and from two days ago', async () => {
    const now = new Date();
    const todaySubmittedAt = new Date(
      orgDayStart(toOrgDayString(now)).getTime() + 60 * 60 * 1000,
    );
    const twoDaysAgo = previousOrgDay(previousOrgDay(now).start);
    const twoDaysAgoSubmittedAt = new Date(
      twoDaysAgo.start.getTime() + 60 * 60 * 1000,
    );

    const applicantToday = await createTestUser();
    const applicantTwoDaysAgo = await createTestUser();
    await createTestApplication(applicantToday, position1, {
      submittedAt: todaySubmittedAt,
    });
    await createTestApplication(applicantTwoDaysAgo, position1, {
      submittedAt: twoDaysAgoSubmittedAt,
    });

    const res = await dailyGET(makeRequest(DAILY_URL, `Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    expect(sentTo(manager.email)).toBeUndefined();

    const logs = await prisma.emailLog.findMany({
      where: { userId: manager.id, template: 'manager_daily_digest' },
    });
    expect(logs).toHaveLength(0);
  });

  it('sends nothing to a manager with no new activity', async () => {
    const res = await dailyGET(makeRequest(DAILY_URL, `Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    expect(sentTo(manager.email)).toBeUndefined();
  });

  it('gates a repeat call the same day after a successful send', async () => {
    const yesterday = previousOrgDay(new Date());
    const submittedAt = new Date(yesterday.start.getTime() + 60 * 60 * 1000);
    const applicant = await createTestUser();
    await createTestApplication(applicant, position1, { submittedAt });

    const first = await dailyGET(
      makeRequest(DAILY_URL, `Bearer ${CRON_SECRET}`),
    );
    expect(first.status).toBe(200);
    expect(sentTo(manager.email)).toBeDefined();

    mockSend.mockClear();

    const second = await dailyGET(
      makeRequest(DAILY_URL, `Bearer ${CRON_SECRET}`),
    );
    const body = (await second.json()) as { skipped: number };
    expect(body.skipped).toBeGreaterThanOrEqual(1);
    expect(sentTo(manager.email)).toBeUndefined();

    const logs = await prisma.emailLog.findMany({
      where: { userId: manager.id, template: 'manager_daily_digest' },
    });
    expect(logs).toHaveLength(1);
  });

  it('does not stop the run when one recipient send fails, and records it as failed', async () => {
    const yesterday = previousOrgDay(new Date());
    const submittedAt = new Date(yesterday.start.getTime() + 60 * 60 * 1000);

    const applicant = await createTestUser();
    await createTestApplication(applicant, position1, { submittedAt });

    const managerOk = await createTestUser();
    const positionOk = await createTestPosition(creator, {
      managers: [managerOk],
    });
    const applicantOk = await createTestUser();
    await createTestApplication(applicantOk, positionOk, { submittedAt });

    mockSend.mockImplementation(async (args: { to: string }) => {
      if (args.to === manager.email) throw new Error('simulated send failure');
      return { data: { id: randomUUID() }, error: null };
    });

    const res = await dailyGET(makeRequest(DAILY_URL, `Bearer ${CRON_SECRET}`));
    const body = (await res.json()) as { sent: number; failed: number };
    expect(body.failed).toBeGreaterThanOrEqual(1);
    expect(sentTo(managerOk.email)).toBeDefined();

    const failedLogs = await prisma.emailLog.findMany({
      where: {
        userId: manager.id,
        template: 'manager_daily_digest',
        status: 'failed',
      },
    });
    expect(failedLogs).toHaveLength(1);
  });

  it('excludes a deactivated manager and a manager who only manages a draft position', async () => {
    const yesterday = previousOrgDay(new Date());
    const submittedAt = new Date(yesterday.start.getTime() + 60 * 60 * 1000);

    const deactivatedManager = await createTestUser({ deletedAt: new Date() });
    const deactivatedManagerPosition = await createTestPosition(creator, {
      managers: [deactivatedManager],
    });
    const applicantA = await createTestUser();
    await createTestApplication(applicantA, deactivatedManagerPosition, {
      submittedAt,
    });

    const draftOnlyManager = await createTestUser();
    const draftPosition = await createTestPosition(creator, {
      managers: [draftOnlyManager],
      status: 'draft',
    });
    const applicantB = await createTestUser();
    await createTestApplication(applicantB, draftPosition, { submittedAt });

    const res = await dailyGET(makeRequest(DAILY_URL, `Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    expect(sentTo(deactivatedManager.email)).toBeUndefined();
    expect(sentTo(draftOnlyManager.email)).toBeUndefined();
  });
});

describe('weekly digest', () => {
  let manager: User;
  let openPosition: Position;
  let closedByDatePosition: Position;

  beforeEach(async () => {
    manager = await createTestUser();
    openPosition = await createTestPosition(creator, { managers: [manager] });
    closedByDatePosition = await createTestPosition(creator, {
      managers: [manager],
      closesAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
  });

  it('sends one email with totals, a status breakdown excluding withdrawn/draft, and open positions excluding a closed-by-date one', async () => {
    const week = previousOrgWeek(new Date());
    const submittedAt = new Date(week.start.getTime() + 60 * 60 * 1000);

    const applicantApplied = await createTestUser();
    const applicantReviewing = await createTestUser();
    const applicantAccepted = await createTestUser();
    const applicantWithdrawn = await createTestUser();
    const applicantDraft = await createTestUser();

    await createTestApplication(applicantApplied, openPosition, {
      submittedAt,
      status: 'applied',
    });
    await createTestApplication(applicantReviewing, openPosition, {
      submittedAt,
      status: 'reviewing',
    });
    await createTestApplication(applicantAccepted, closedByDatePosition, {
      submittedAt,
      status: 'accepted',
    });
    await createTestApplication(applicantWithdrawn, openPosition, {
      submittedAt,
      status: 'withdrawn',
    });
    await createTestApplication(applicantDraft, openPosition, {
      submittedAt,
      status: 'draft',
    });

    const res = await weeklyGET(
      makeRequest(WEEKLY_URL, `Bearer ${CRON_SECRET}`),
    );
    expect(res.status).toBe(200);

    const call = sentTo(manager.email);
    expect(call).toBeDefined();
    expect(call?.subject).toBe('Your week on Aplio: 3 new applications');
    expect(call?.html).toContain('?status=applied');
    expect(call?.html).toContain('?status=reviewing');
    expect(call?.html).toContain('?status=accepted');
    expect(call?.html).toContain(`?positionId=${openPosition.id}`);
    expect(call?.html).not.toContain(`?positionId=${closedByDatePosition.id}`);

    const logs = await prisma.emailLog.findMany({
      where: { userId: manager.id, template: 'manager_weekly_digest' },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.applicationId).toBeNull();
  });

  it('sends nothing with zero new applications and nothing unresolved', async () => {
    const res = await weeklyGET(
      makeRequest(WEEKLY_URL, `Bearer ${CRON_SECRET}`),
    );
    expect(res.status).toBe(200);
    expect(sentTo(manager.email)).toBeUndefined();
  });

  it('sends the awaiting-review subject with zero new applications but something unresolved', async () => {
    const now = new Date();
    const twoWeeksAgo = previousOrgWeek(previousOrgWeek(now).start);
    const submittedAt = new Date(twoWeeksAgo.start.getTime() + 60 * 60 * 1000);
    const applicant = await createTestUser();
    await createTestApplication(applicant, openPosition, {
      submittedAt,
      status: 'applied',
    });

    const res = await weeklyGET(
      makeRequest(WEEKLY_URL, `Bearer ${CRON_SECRET}`),
    );
    expect(res.status).toBe(200);

    const call = sentTo(manager.email);
    expect(call).toBeDefined();
    expect(call?.subject).toBe(
      'Your week on Aplio: 1 application awaiting review',
    );
  });

  it('gates a repeat call the same week', async () => {
    const week = previousOrgWeek(new Date());
    const submittedAt = new Date(week.start.getTime() + 60 * 60 * 1000);
    const applicant = await createTestUser();
    await createTestApplication(applicant, openPosition, {
      submittedAt,
      status: 'applied',
    });

    const first = await weeklyGET(
      makeRequest(WEEKLY_URL, `Bearer ${CRON_SECRET}`),
    );
    expect(first.status).toBe(200);
    expect(sentTo(manager.email)).toBeDefined();

    mockSend.mockClear();

    const second = await weeklyGET(
      makeRequest(WEEKLY_URL, `Bearer ${CRON_SECRET}`),
    );
    const body = (await second.json()) as { skipped: number };
    expect(body.skipped).toBeGreaterThanOrEqual(1);
    expect(sentTo(manager.email)).toBeUndefined();
  });

  it('is not gated by an existing daily-digest row for the same manager', async () => {
    const week = previousOrgWeek(new Date());
    const submittedAt = new Date(week.start.getTime() + 60 * 60 * 1000);
    const applicant = await createTestUser();
    await createTestApplication(applicant, openPosition, {
      submittedAt,
      status: 'applied',
    });

    await prisma.emailLog.create({
      data: {
        to: manager.email,
        userId: manager.id,
        template: 'manager_daily_digest',
        subject: `${TEST_PREFIX}unrelated daily digest`,
        status: 'sent',
      },
    });

    const res = await weeklyGET(
      makeRequest(WEEKLY_URL, `Bearer ${CRON_SECRET}`),
    );
    expect(res.status).toBe(200);
    expect(sentTo(manager.email)).toBeDefined();
  });
});
