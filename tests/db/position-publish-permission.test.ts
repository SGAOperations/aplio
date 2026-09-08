import {
  TEST_PREFIX,
  cleanupFixtures,
  createTestPosition,
  createTestUser,
} from '@/tests/helpers/fixtures';
import { actAs } from '@/tests/stubs/auth-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  updatePositionStatus,
  updatePositionTitle,
} from '@/prisma/actions/position-actions';
import type { Position, User } from '@/prisma/client';

import {
  POSITION_DRAFT_CLOSE_BLOCKED_ERROR,
  POSITION_OPEN_REQUIRES_ADMIN_ERROR,
} from '@/lib/constants';
import { prisma } from '@/lib/prisma';

let admin: User;
let manager: User;

beforeAll(async () => {
  admin = await createTestUser({ isAdmin: true });
  manager = await createTestUser();
  await createTestPosition(admin, { managers: [manager] });
});

afterAll(async () => {
  await cleanupFixtures();
});

async function makePosition(
  status: 'draft' | 'open' | 'closed',
): Promise<Position> {
  return createTestPosition(admin, { managers: [manager], status });
}

describe('updatePositionStatus — status-transition permission', () => {
  it('refuses a manager moving draft to open, row unchanged', async () => {
    const position = await makePosition('draft');
    actAs(manager);
    const result = await updatePositionStatus({
      id: position.id,
      status: 'open',
    });
    expect(result).toEqual({ error: POSITION_OPEN_REQUIRES_ADMIN_ERROR });

    const row = await prisma.position.findUniqueOrThrow({
      where: { id: position.id },
      select: { status: true },
    });
    expect(row.status).toBe('draft');
  });

  it('refuses a manager moving closed to open, row unchanged', async () => {
    const position = await makePosition('closed');
    actAs(manager);
    const result = await updatePositionStatus({
      id: position.id,
      status: 'open',
    });
    expect(result).toEqual({ error: POSITION_OPEN_REQUIRES_ADMIN_ERROR });

    const row = await prisma.position.findUniqueOrThrow({
      where: { id: position.id },
      select: { status: true },
    });
    expect(row.status).toBe('closed');
  });

  it('allows a manager moving open to closed', async () => {
    const position = await makePosition('open');
    actAs(manager);
    const result = await updatePositionStatus({
      id: position.id,
      status: 'closed',
    });
    expect(result).toBeUndefined();

    const row = await prisma.position.findUniqueOrThrow({
      where: { id: position.id },
      select: { status: true },
    });
    expect(row.status).toBe('closed');
  });

  it('refuses a manager moving draft to closed, row unchanged', async () => {
    const position = await makePosition('draft');
    actAs(manager);
    const result = await updatePositionStatus({
      id: position.id,
      status: 'closed',
    });
    expect(result).toEqual({ error: POSITION_DRAFT_CLOSE_BLOCKED_ERROR });

    const row = await prisma.position.findUniqueOrThrow({
      where: { id: position.id },
      select: { status: true },
    });
    expect(row.status).toBe('draft');
  });

  it('allows a manager moving closed to draft', async () => {
    const position = await makePosition('closed');
    actAs(manager);
    const result = await updatePositionStatus({
      id: position.id,
      status: 'draft',
    });
    expect(result).toBeUndefined();

    const row = await prisma.position.findUniqueOrThrow({
      where: { id: position.id },
      select: { status: true },
    });
    expect(row.status).toBe('draft');
  });

  it('lets a manager save an unchanged open status along with other edits', async () => {
    const position = await makePosition('open');
    actAs(manager);
    const titleResult = await updatePositionTitle({
      id: position.id,
      title: `${TEST_PREFIX}manager-edited-title`,
    });
    expect(titleResult).toBeUndefined();
    const statusResult = await updatePositionStatus({
      id: position.id,
      status: 'open',
    });
    expect(statusResult).toBeUndefined();

    const row = await prisma.position.findUniqueOrThrow({
      where: { id: position.id },
      select: { status: true, title: true },
    });
    expect(row.status).toBe('open');
    expect(row.title).toBe(`${TEST_PREFIX}manager-edited-title`);
  });

  it('allows an admin every transition, including to open', async () => {
    actAs(admin);

    const draftToOpen = await makePosition('draft');
    expect(
      await updatePositionStatus({ id: draftToOpen.id, status: 'open' }),
    ).toBeUndefined();

    const closedToOpen = await makePosition('closed');
    expect(
      await updatePositionStatus({ id: closedToOpen.id, status: 'open' }),
    ).toBeUndefined();

    const openToClosed = await makePosition('open');
    expect(
      await updatePositionStatus({ id: openToClosed.id, status: 'closed' }),
    ).toBeUndefined();

    const closedToDraft = await makePosition('closed');
    expect(
      await updatePositionStatus({ id: closedToDraft.id, status: 'draft' }),
    ).toBeUndefined();

    const rows = await prisma.position.findMany({
      where: {
        id: {
          in: [
            draftToOpen.id,
            closedToOpen.id,
            openToClosed.id,
            closedToDraft.id,
          ],
        },
      },
      select: { id: true, status: true },
    });
    const statusById = new Map(rows.map((r) => [r.id, r.status]));
    expect(statusById.get(draftToOpen.id)).toBe('open');
    expect(statusById.get(closedToOpen.id)).toBe('open');
    expect(statusById.get(openToClosed.id)).toBe('closed');
    expect(statusById.get(closedToDraft.id)).toBe('draft');
  });
});
