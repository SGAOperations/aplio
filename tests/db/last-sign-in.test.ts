import { cleanupFixtures, createTestUser } from '@/tests/helpers/fixtures';
import { afterAll, describe, expect, it } from 'vitest';

import { getUsersForAdmin } from '@/prisma/data/users';

import {
  assertSessionUserActive,
  recordSignIn,
} from '@/lib/auth/session-hooks';
import { ACCOUNT_DEACTIVATED_ERROR_CODE } from '@/lib/constants';
import { prisma } from '@/lib/prisma';

afterAll(async () => {
  await cleanupFixtures();
});

describe('recordSignIn', () => {
  it('stamps a null lastLoginAt', async () => {
    const user = await createTestUser();
    expect(user.lastLoginAt).toBeNull();

    await recordSignIn(user.id);

    const stamped = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(stamped.lastLoginAt).not.toBeNull();
  });

  it('overwrites an earlier stamp on a second call', async () => {
    const user = await createTestUser();

    await recordSignIn(user.id);
    const first = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });

    await recordSignIn(user.id);
    const second = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });

    expect(second.lastLoginAt!.getTime()).toBeGreaterThanOrEqual(
      first.lastLoginAt!.getTime(),
    );
  });

  it('leaves a deactivated user untouched', async () => {
    const user = await createTestUser({ deletedAt: new Date() });

    await recordSignIn(user.id);

    const unchanged = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(unchanged.lastLoginAt).toBeNull();
  });
});

describe('assertSessionUserActive', () => {
  it('rejects a deactivated user with ACCOUNT_DEACTIVATED_ERROR_CODE', async () => {
    const user = await createTestUser({ deletedAt: new Date() });

    await expect(assertSessionUserActive(user.id)).rejects.toMatchObject({
      body: { code: ACCOUNT_DEACTIVATED_ERROR_CODE },
    });
  });

  it('resolves for an active user', async () => {
    const user = await createTestUser();
    await expect(assertSessionUserActive(user.id)).resolves.toBeUndefined();
  });
});

describe('getUsersForAdmin', () => {
  it('includes lastLoginAt', async () => {
    const user = await createTestUser();
    await recordSignIn(user.id);

    const list = await getUsersForAdmin();
    const row = list.find((u) => u.id === user.id);
    expect(row?.lastLoginAt).not.toBeNull();
  });
});
