import {
  TEST_PREFIX,
  cleanupFixtures,
  createTestPosition,
  createTestUser,
} from '@/tests/helpers/fixtures';
import { actAs } from '@/tests/stubs/auth-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  updatePositionDescription,
  updatePositionSchedule,
  updatePositionTitle,
} from '@/prisma/actions/position-actions';
import type { Position, User } from '@/prisma/client';

import {
  POSITION_CLOSES_AT_PAST_ERROR,
  POSITION_OPENS_AT_PAST_ERROR,
} from '@/lib/constants';
import { orgDayEnd, orgDayStart, toOrgDayString } from '@/lib/dates';
import { prisma } from '@/lib/prisma';

let admin: User;
let manager: User;

function daysFromToday(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toOrgDayString(d);
}

const futureOpen = daysFromToday(10);
const futureClose = daysFromToday(20);
const pastDay = daysFromToday(-5);

async function makePosition(
  overrides: Parameters<typeof createTestPosition>[1] = {},
): Promise<Position> {
  return createTestPosition(admin, { managers: [manager], ...overrides });
}

async function loadPosition(id: string) {
  return prisma.position.findUniqueOrThrow({
    where: { id },
    select: {
      title: true,
      description: true,
      opensAt: true,
      closesAt: true,
      updatedById: true,
    },
  });
}

beforeAll(async () => {
  admin = await createTestUser({ isAdmin: true });
  manager = await createTestUser();
});

afterAll(async () => {
  await cleanupFixtures();
});

describe('updatePositionTitle', () => {
  it('persists only the title, and records updatedById', async () => {
    const position = await makePosition({
      title: `${TEST_PREFIX}original-title`,
      description: `${TEST_PREFIX}original-description`,
    });

    actAs(manager);
    const result = await updatePositionTitle({
      id: position.id,
      title: `${TEST_PREFIX}new-title`,
    });
    expect(result).toBeUndefined();

    const row = await loadPosition(position.id);
    expect(row.title).toBe(`${TEST_PREFIX}new-title`);
    expect(row.description).toBe(`${TEST_PREFIX}original-description`);
    expect(row.updatedById).toBe(manager.id);
  });
});

describe('updatePositionDescription', () => {
  it('persists only the description, and records updatedById', async () => {
    const position = await makePosition({
      title: `${TEST_PREFIX}kept-title`,
      description: `${TEST_PREFIX}original-description`,
    });

    actAs(manager);
    const result = await updatePositionDescription({
      id: position.id,
      description: `${TEST_PREFIX}new-description`,
    });
    expect(result).toBeUndefined();

    const row = await loadPosition(position.id);
    expect(row.title).toBe(`${TEST_PREFIX}kept-title`);
    expect(row.description).toBe(`${TEST_PREFIX}new-description`);
    expect(row.updatedById).toBe(manager.id);
  });
});

describe('updatePositionSchedule', () => {
  it('persists both dates as a pair, and records updatedById', async () => {
    const position = await makePosition({});

    actAs(manager);
    const result = await updatePositionSchedule({
      id: position.id,
      opensAt: futureOpen,
      closesAt: futureClose,
    });
    expect(result).toBeUndefined();

    const row = await loadPosition(position.id);
    expect(row.opensAt?.getTime()).toBe(orgDayStart(futureOpen).getTime());
    expect(row.closesAt?.getTime()).toBe(orgDayEnd(futureClose).getTime());
    expect(row.updatedById).toBe(manager.id);
  });

  it('writes null when a date is cleared', async () => {
    const position = await makePosition({
      opensAt: orgDayStart(futureOpen),
      closesAt: orgDayEnd(futureClose),
    });

    actAs(manager);
    const result = await updatePositionSchedule({
      id: position.id,
      opensAt: undefined,
      closesAt: undefined,
    });
    expect(result).toBeUndefined();

    const row = await loadPosition(position.id);
    expect(row.opensAt).toBeNull();
    expect(row.closesAt).toBeNull();
  });

  it('refuses a changed past date and writes nothing', async () => {
    const position = await makePosition({ opensAt: orgDayStart(futureOpen) });

    actAs(manager);
    const result = await updatePositionSchedule({
      id: position.id,
      opensAt: pastDay,
      closesAt: futureClose,
    });
    expect(result).toEqual({ error: POSITION_OPENS_AT_PAST_ERROR });

    const row = await loadPosition(position.id);
    expect(row.opensAt?.getTime()).toBe(orgDayStart(futureOpen).getTime());
    expect(row.closesAt).toBeNull();
  });

  it('leaves an unchanged past date alone, refusing only the newly-changed one', async () => {
    const position = await makePosition({ opensAt: orgDayStart(pastDay) });

    actAs(manager);
    const result = await updatePositionSchedule({
      id: position.id,
      opensAt: pastDay,
      closesAt: pastDay,
    });
    expect(result).toEqual({ error: POSITION_CLOSES_AT_PAST_ERROR });

    const row = await loadPosition(position.id);
    expect(row.closesAt).toBeNull();
  });
});
