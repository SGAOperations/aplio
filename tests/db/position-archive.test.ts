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
  addPositionManager,
  removePositionManager,
} from '@/prisma/actions/position-actions';
import type { Position, User } from '@/prisma/client';
import {
  checkPositionEditable,
  getManagedPositions,
} from '@/prisma/data/positions';

import {
  ARCHIVED_POSITION_EDIT_ERROR,
  MANAGED_POSITIONS_WINDOW_DAYS,
} from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { isPositionActive } from '@/lib/utils';

const now = new Date();
const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
const staleClosedAt = new Date(
  now.getTime() - (MANAGED_POSITIONS_WINDOW_DAYS + 10) * 24 * 60 * 60 * 1000,
);
const staleEventAt = new Date(
  now.getTime() - (MANAGED_POSITIONS_WINDOW_DAYS + 5) * 24 * 60 * 60 * 1000,
);
const recentEventAt = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

let admin: User;
let manager: User;
let applicant: User;
let forgottenPosition: Position;
let workedPosition: Position;
let recentlyClosedPosition: Position;

beforeAll(async () => {
  admin = await createTestUser({ isAdmin: true });
  manager = await createTestUser();
  applicant = await createTestUser();

  forgottenPosition = await createTestPosition(admin, {
    managers: [manager],
    status: 'closed',
    closesAt: staleClosedAt,
  });
  // A single 'applied' application with no status event at all — the
  // forgotten-applicant case (#581): archives despite staying unresolved.
  await createTestApplication(applicant, forgottenPosition, {
    status: 'applied',
    submittedAt: staleClosedAt,
  });

  workedPosition = await createTestPosition(admin, {
    managers: [manager],
    status: 'closed',
    closesAt: staleClosedAt,
  });
  await createTestApplication(applicant, workedPosition, {
    status: 'reviewing',
    submittedAt: staleClosedAt,
    statusEvents: {
      create: [
        {
          from: 'applied',
          to: 'reached_out',
          changedById: manager.id,
          createdAt: staleEventAt,
        },
        {
          from: 'reached_out',
          to: 'reviewing',
          changedById: manager.id,
          createdAt: recentEventAt,
        },
      ],
    },
  });

  recentlyClosedPosition = await createTestPosition(admin, {
    managers: [manager],
    status: 'closed',
    closesAt: tenDaysAgo,
  });
});

afterAll(async () => {
  await cleanupFixtures();
});

describe('positionActivitySelect / withPositionActivity', () => {
  it('surfaces the latest counted status event as lastStatusChangeAt', async () => {
    const positions = await getManagedPositions(manager.id);
    const worked = positions.find((p) => p.id === workedPosition.id);
    expect(worked?.lastStatusChangeAt?.getTime()).toBe(recentEventAt.getTime());
  });

  it('is null when no application ever had a counted status event', async () => {
    const positions = await getManagedPositions(manager.id);
    const forgotten = positions.find((p) => p.id === forgottenPosition.id);
    expect(forgotten?.lastStatusChangeAt).toBeNull();
  });

  it('partitions active vs archived exactly as isPositionActive would', async () => {
    const positions = await getManagedPositions(manager.id);
    for (const position of positions)
      expect(isPositionActive(position)).toBe(
        position.id === recentlyClosedPosition.id ||
          position.id === workedPosition.id,
      );
  });
});

describe('checkPositionEditable', () => {
  it('refuses a newly-archivable position for its manager', async () => {
    const editable = await checkPositionEditable(forgottenPosition.id, {
      id: manager.id,
      isAdmin: false,
    });
    expect(editable).toBe(false);
  });

  it('allows the same position for an admin', async () => {
    const editable = await checkPositionEditable(forgottenPosition.id, {
      id: admin.id,
      isAdmin: true,
    });
    expect(editable).toBe(true);
  });

  it('allows a position with a recent status change for its manager', async () => {
    const editable = await checkPositionEditable(workedPosition.id, {
      id: manager.id,
      isAdmin: false,
    });
    expect(editable).toBe(true);
  });
});

describe('managers on an archived position', () => {
  it("refuses a manager's addPositionManager", async () => {
    const target = await createTestUser();

    actAs(manager);
    const result = await addPositionManager({
      positionId: forgottenPosition.id,
      email: target.email,
    });
    expect(result).toEqual({ error: ARCHIVED_POSITION_EDIT_ERROR });
  });

  it("refuses a manager's removePositionManager", async () => {
    const extraManager = await createTestUser({
      name: `${TEST_PREFIX}extra-manager`,
    });
    await prisma.position.update({
      where: { id: forgottenPosition.id },
      data: { managers: { connect: { id: extraManager.id } } },
    });

    actAs(manager);
    const result = await removePositionManager({
      positionId: forgottenPosition.id,
      userId: extraManager.id,
    });
    expect(result).toEqual({ error: ARCHIVED_POSITION_EDIT_ERROR });
  });

  it("allows an admin's addPositionManager and removePositionManager", async () => {
    const target = await createTestUser();

    actAs(admin);
    const addResult = await addPositionManager({
      positionId: forgottenPosition.id,
      email: target.email,
    });
    expect(addResult).not.toEqual({ error: ARCHIVED_POSITION_EDIT_ERROR });

    const removeResult = await removePositionManager({
      positionId: forgottenPosition.id,
      userId: target.id,
    });
    expect(removeResult).toBeUndefined();
  });
});
