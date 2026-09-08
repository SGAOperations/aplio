import {
  TEST_PREFIX,
  cleanupFixtures,
  createTestUser,
} from '@/tests/helpers/fixtures';
import { actAs } from '@/tests/stubs/auth-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPosition } from '@/prisma/actions/position-actions';
import type { User } from '@/prisma/client';

import { POSITION_MANAGERS_REQUIRED_ERROR } from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { isError } from '@/lib/utils';

let admin: User;
let manager: User;
let otherManager: User;

beforeAll(async () => {
  admin = await createTestUser({ isAdmin: true });
  manager = await createTestUser();
  otherManager = await createTestUser();
});

afterAll(async () => {
  await cleanupFixtures();
});

describe('createPosition', () => {
  it('connects only the selected managers, not the creator', async () => {
    actAs(admin);
    const result = await createPosition({
      title: `${TEST_PREFIX}selected-managers-only`,
      managerEmails: [manager.email, otherManager.email],
    });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;

    const position = await prisma.position.findUniqueOrThrow({
      where: { id: result.id },
      select: { managers: { select: { id: true } } },
    });
    const managerIds = position.managers.map((m) => m.id).sort();
    expect(managerIds).toEqual([manager.id, otherManager.id].sort());
    expect(managerIds).not.toContain(admin.id);
  });

  it('connects the creator when they select themselves', async () => {
    actAs(manager);
    const result = await createPosition({
      title: `${TEST_PREFIX}creator-selected-self`,
      managerEmails: [manager.email],
    });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;

    const position = await prisma.position.findUniqueOrThrow({
      where: { id: result.id },
      select: { managers: { select: { id: true } } },
    });
    expect(position.managers.map((m) => m.id)).toEqual([manager.id]);
  });

  it('refuses zero managers and writes nothing', async () => {
    actAs(admin);
    const title = `${TEST_PREFIX}zero-managers`;
    const result = await createPosition({ title, managerEmails: [] });
    expect(result).toEqual({ error: POSITION_MANAGERS_REQUIRED_ERROR });

    const position = await prisma.position.findFirst({ where: { title } });
    expect(position).toBeNull();
  });

  it('creates as draft with an empty description and no dates, ignoring a posted status', async () => {
    actAs(admin);
    const result = await createPosition({
      title: `${TEST_PREFIX}always-draft`,
      managerEmails: [manager.email],
      status: 'open',
    });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;

    const position = await prisma.position.findUniqueOrThrow({
      where: { id: result.id },
      select: {
        status: true,
        description: true,
        opensAt: true,
        closesAt: true,
      },
    });
    expect(position.status).toBe('draft');
    expect(position.description).toBe('');
    expect(position.opensAt).toBeNull();
    expect(position.closesAt).toBeNull();
  });

  it('refuses a soft-deleted manager email and writes nothing', async () => {
    const deletedUser = await createTestUser({ deletedAt: new Date() });
    actAs(admin);
    const title = `${TEST_PREFIX}deleted-manager`;
    const result = await createPosition({
      title,
      managerEmails: [deletedUser.email],
    });
    expect(result).toEqual({
      error: 'One of the selected users is no longer available.',
    });

    const position = await prisma.position.findFirst({ where: { title } });
    expect(position).toBeNull();
  });
});
