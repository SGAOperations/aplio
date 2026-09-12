import {
  TEST_PREFIX,
  cleanupFixtures,
  createTestApplication,
  createTestPosition,
  createTestUser,
} from '@/tests/helpers/fixtures';
import { actAs } from '@/tests/stubs/auth-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  updatePositionSchedule,
  updatePositionStatus,
  updatePositionTitle,
} from '@/prisma/actions/position-actions';
import type { Position, User } from '@/prisma/client';

import {
  POSITION_CLOSED_DRAFT_BLOCKED_ERROR,
  POSITION_DRAFT_CLOSE_BLOCKED_ERROR,
  POSITION_REOPEN_PAST_CLOSE_ERROR,
  POSITION_UNPUBLISH_BLOCKED_ERROR,
} from '@/lib/constants';
import { orgDayEnd, toOrgDayString } from '@/lib/dates';
import { prisma } from '@/lib/prisma';

let admin: User;
let manager: User;
let applicant: User;

function daysFromToday(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toOrgDayString(d);
}

const pastDay = daysFromToday(-5);
const futureDay = daysFromToday(10);

async function makePosition(
  overrides: Parameters<typeof createTestPosition>[1] = {},
): Promise<Position> {
  return createTestPosition(admin, { managers: [manager], ...overrides });
}

async function status(id: string): Promise<string> {
  const row = await prisma.position.findUniqueOrThrow({
    where: { id },
    select: { status: true },
  });
  return row.status;
}

beforeAll(async () => {
  admin = await createTestUser({ isAdmin: true });
  manager = await createTestUser();
  applicant = await createTestUser();
});

afterAll(async () => {
  await cleanupFixtures();
});

describe('unpublish (open -> draft)', () => {
  it('is blocked once any non-deleted application exists, even a draft one', async () => {
    const position = await makePosition({ status: 'open' });
    await createTestApplication(applicant, position, { status: 'draft' });

    actAs(manager);
    const result = await updatePositionStatus({
      id: position.id,
      status: 'draft',
    });
    expect(result).toEqual({ error: POSITION_UNPUBLISH_BLOCKED_ERROR });
    expect(await status(position.id)).toBe('open');
  });

  it('succeeds with no applications', async () => {
    const position = await makePosition({ status: 'open' });

    actAs(manager);
    const result = await updatePositionStatus({
      id: position.id,
      status: 'draft',
    });
    expect(result).toBeUndefined();
    expect(await status(position.id)).toBe('draft');
  });
});

describe('closed -> draft', () => {
  it('is always blocked — reopening is the only legal move out of closed', async () => {
    const position = await makePosition({ status: 'closed' });

    actAs(manager);
    const result = await updatePositionStatus({
      id: position.id,
      status: 'draft',
    });
    expect(result).toEqual({ error: POSITION_CLOSED_DRAFT_BLOCKED_ERROR });
    expect(await status(position.id)).toBe('closed');
  });
});

describe('reopen (closed -> open)', () => {
  it('is blocked when the stored closesAt is in the past', async () => {
    const position = await makePosition({
      status: 'closed',
      closesAt: orgDayEnd(pastDay),
    });

    actAs(admin);
    const result = await updatePositionStatus({
      id: position.id,
      status: 'open',
    });
    expect(result).toEqual({ error: POSITION_REOPEN_PAST_CLOSE_ERROR });
    expect(await status(position.id)).toBe('closed');
  });

  it('succeeds when closesAt is null', async () => {
    const position = await makePosition({ status: 'closed' });

    actAs(admin);
    const result = await updatePositionStatus({
      id: position.id,
      status: 'open',
    });
    expect(result).toBeUndefined();
    expect(await status(position.id)).toBe('open');
  });

  it('succeeds once the past closesAt is extended in an earlier save', async () => {
    const position = await makePosition({
      status: 'closed',
      closesAt: orgDayEnd(pastDay),
    });

    actAs(admin);
    const scheduleResult = await updatePositionSchedule({
      id: position.id,
      closesAt: futureDay,
    });
    expect(scheduleResult).toBeUndefined();

    const statusResult = await updatePositionStatus({
      id: position.id,
      status: 'open',
    });
    expect(statusResult).toBeUndefined();
    expect(await status(position.id)).toBe('open');
  });
});

describe('draft -> closed', () => {
  it('is always blocked — a draft has never accepted applications', async () => {
    const position = await makePosition({ status: 'draft' });

    actAs(manager);
    const result = await updatePositionStatus({
      id: position.id,
      status: 'closed',
    });
    expect(result).toEqual({ error: POSITION_DRAFT_CLOSE_BLOCKED_ERROR });
    expect(await status(position.id)).toBe('draft');
  });
});

describe('unchanged status', () => {
  it('is never a transition — saving another field with applications present still succeeds', async () => {
    const position = await makePosition({ status: 'open' });
    await createTestApplication(applicant, position, { status: 'applied' });

    actAs(manager);
    const result = await updatePositionTitle({
      id: position.id,
      title: `${TEST_PREFIX}retitled`,
    });
    expect(result).toBeUndefined();

    const row = await prisma.position.findUniqueOrThrow({
      where: { id: position.id },
      select: { status: true, title: true },
    });
    expect(row.status).toBe('open');
    expect(row.title).toBe(`${TEST_PREFIX}retitled`);
  });

  it('saving the same status back is a no-op, even with applications present', async () => {
    const position = await makePosition({ status: 'open' });
    await createTestApplication(applicant, position, { status: 'applied' });

    actAs(manager);
    const result = await updatePositionStatus({
      id: position.id,
      status: 'open',
    });
    expect(result).toBeUndefined();
    expect(await status(position.id)).toBe('open');
  });
});
