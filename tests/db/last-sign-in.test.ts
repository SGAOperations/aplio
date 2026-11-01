import {
  TEST_PREFIX,
  cleanupFixtures,
  createTestUser,
} from '@/tests/helpers/fixtures';
import type { SgaSession } from '@nusgaops/sgauth';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';

import { getUsersForAdmin } from '@/prisma/data/users';

import { recordSignIn, resolveSgauthUser } from '@/lib/auth/session-hooks';
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

function sgaSession(
  overrides: {
    id?: string;
    email?: string;
    name?: string;
    createdAt?: Date;
    positions?: string[];
  } = {},
): SgaSession {
  return {
    user: {
      id: overrides.id ?? randomUUID(),
      email:
        overrides.email ?? `${TEST_PREFIX}${randomUUID()}@northeastern.edu`,
      name: overrides.name ?? 'Sga User',
      preferredName: null,
      isAdmin: false,
      isPrimaryAdmin: false,
    },
    positions: (overrides.positions ?? []).map((key) => ({ key, name: key })),
    session: {
      id: randomUUID(),
      createdAt: (overrides.createdAt ?? new Date()).toISOString(),
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      absoluteExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    },
  };
}

describe('resolveSgauthUser', () => {
  it('creates the Aplio row on first sign-in and stamps it', async () => {
    const session = sgaSession();

    const user = await resolveSgauthUser(session);

    expect(user.sgauthUserId).toBe(session.user.id);
    expect(user.email).toBe(session.user.email);
    expect(user.name).toBe('Sga User');
    expect(user.lastLoginAt).not.toBeNull();
  });

  it('links an unlinked row by address, ignoring case', async () => {
    const existing = await createTestUser();
    const session = sgaSession({ email: existing.email.toUpperCase() });

    const user = await resolveSgauthUser(session);

    expect(user.id).toBe(existing.id);
    expect(user.sgauthUserId).toBe(session.user.id);
  });

  it('never takes over a row linked to another SGAuth user', async () => {
    const existing = await createTestUser({ sgauthUserId: randomUUID() });

    await expect(
      resolveSgauthUser(sgaSession({ email: existing.email })),
    ).rejects.toThrow();
  });

  it('stamps once per SGAuth session', async () => {
    const session = sgaSession({ createdAt: new Date(Date.now() - 60_000) });
    const first = await resolveSgauthUser(session);
    const second = await resolveSgauthUser(session);

    expect(second.lastLoginAt).toEqual(first.lastLoginAt);
  });

  it('fills a blank Aplio name from SGAuth', async () => {
    const existing = await createTestUser({ name: null });

    const user = await resolveSgauthUser(
      sgaSession({ email: existing.email, name: 'Ada Lovelace' }),
    );

    expect(user.name).toBe('Ada Lovelace');
  });

  it.each([
    'student-body-president',
    'executive-vice-president',
    'vice-president-of-operational-affairs',
  ])('mirrors the %s position onto isAdmin', async (position) => {
    const existing = await createTestUser();

    const promoted = await resolveSgauthUser(
      sgaSession({ email: existing.email, positions: [position] }),
    );
    expect(promoted.isAdmin).toBe(true);

    const demoted = await resolveSgauthUser(
      sgaSession({ id: promoted.sgauthUserId!, email: existing.email }),
    );
    expect(demoted.isAdmin).toBe(false);
  });

  it('does not grant admin for other positions or SGAuth admin', async () => {
    const session = sgaSession({
      positions: ['vice-president-of-academic-affairs', 'senator'],
    });
    session.user.isAdmin = true;
    session.user.isPrimaryAdmin = true;

    const user = await resolveSgauthUser(session);
    expect(user.isAdmin).toBe(false);
  });

  it('returns a deactivated row unstamped', async () => {
    const existing = await createTestUser({ deletedAt: new Date() });

    const user = await resolveSgauthUser(sgaSession({ email: existing.email }));

    expect(user.deletedAt).not.toBeNull();
    expect(user.lastLoginAt).toBeNull();
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
