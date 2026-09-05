import {
  TEST_PREFIX,
  cleanupFixtures,
  createTestPosition,
  createTestUser,
} from '@/tests/helpers/fixtures';
import { actAs } from '@/tests/stubs/auth-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createPosition,
  updatePosition,
} from '@/prisma/actions/position-actions';
import type { Position, User } from '@/prisma/client';

import { POSITION_OPEN_REQUIRES_ADMIN_ERROR } from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { isError } from '@/lib/utils';

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

describe('createPosition — status permission', () => {
  it('refuses a manager creating with status open', async () => {
    actAs(manager);
    const result = await createPosition({
      title: `${TEST_PREFIX}manager-created-open`,
      description: '',
      status: 'open',
    });
    expect(result).toEqual({ error: POSITION_OPEN_REQUIRES_ADMIN_ERROR });
  });

  it('allows a manager creating with status draft', async () => {
    actAs(manager);
    const result = await createPosition({
      title: `${TEST_PREFIX}manager-created-draft`,
      description: '',
      status: 'draft',
    });
    expect(isError(result)).toBe(false);
  });

  it('allows a manager creating with status closed', async () => {
    actAs(manager);
    const result = await createPosition({
      title: `${TEST_PREFIX}manager-created-closed`,
      description: '',
      status: 'closed',
    });
    expect(isError(result)).toBe(false);
  });

  it('allows an admin creating with any status', async () => {
    actAs(admin);
    for (const status of ['draft', 'open', 'closed'] as const) {
      const result = await createPosition({
        title: `${TEST_PREFIX}admin-created-${status}`,
        description: '',
        status,
      });
      expect(isError(result)).toBe(false);
    }
  });
});

describe('updatePosition — status-transition permission', () => {
  it('refuses a manager moving draft to open, row unchanged', async () => {
    const position = await makePosition('draft');
    actAs(manager);
    const result = await updatePosition({
      id: position.id,
      title: position.title,
      description: '',
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
    const result = await updatePosition({
      id: position.id,
      title: position.title,
      description: '',
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
    const result = await updatePosition({
      id: position.id,
      title: position.title,
      description: '',
      status: 'closed',
    });
    expect(result).toBeUndefined();

    const row = await prisma.position.findUniqueOrThrow({
      where: { id: position.id },
      select: { status: true },
    });
    expect(row.status).toBe('closed');
  });

  it('allows a manager moving draft to closed', async () => {
    const position = await makePosition('draft');
    actAs(manager);
    const result = await updatePosition({
      id: position.id,
      title: position.title,
      description: '',
      status: 'closed',
    });
    expect(result).toBeUndefined();

    const row = await prisma.position.findUniqueOrThrow({
      where: { id: position.id },
      select: { status: true },
    });
    expect(row.status).toBe('closed');
  });

  it('allows a manager moving closed to draft', async () => {
    const position = await makePosition('closed');
    actAs(manager);
    const result = await updatePosition({
      id: position.id,
      title: position.title,
      description: '',
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
    const result = await updatePosition({
      id: position.id,
      title: `${TEST_PREFIX}manager-edited-title`,
      description: '',
      status: 'open',
    });
    expect(result).toBeUndefined();

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
      await updatePosition({
        id: draftToOpen.id,
        title: draftToOpen.title,
        description: '',
        status: 'open',
      }),
    ).toBeUndefined();

    const closedToOpen = await makePosition('closed');
    expect(
      await updatePosition({
        id: closedToOpen.id,
        title: closedToOpen.title,
        description: '',
        status: 'open',
      }),
    ).toBeUndefined();

    const openToClosed = await makePosition('open');
    expect(
      await updatePosition({
        id: openToClosed.id,
        title: openToClosed.title,
        description: '',
        status: 'closed',
      }),
    ).toBeUndefined();

    const draftToClosed = await makePosition('draft');
    expect(
      await updatePosition({
        id: draftToClosed.id,
        title: draftToClosed.title,
        description: '',
        status: 'closed',
      }),
    ).toBeUndefined();

    const closedToDraft = await makePosition('closed');
    expect(
      await updatePosition({
        id: closedToDraft.id,
        title: closedToDraft.title,
        description: '',
        status: 'draft',
      }),
    ).toBeUndefined();

    const rows = await prisma.position.findMany({
      where: {
        id: {
          in: [
            draftToOpen.id,
            closedToOpen.id,
            openToClosed.id,
            draftToClosed.id,
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
    expect(statusById.get(draftToClosed.id)).toBe('closed');
    expect(statusById.get(closedToDraft.id)).toBe('draft');
  });
});
