import {
  TEST_PREFIX,
  cleanupFixtures,
  createTestUser,
} from '@/tests/helpers/fixtures';
import { actAs } from '@/tests/stubs/auth-server';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { setUserName } from '@/prisma/actions/profile';
import { createUser } from '@/prisma/actions/users';
import type { User } from '@/prisma/client';

import { prisma } from '@/lib/prisma';

const MIGRATION_SQL_PATH = path.join(
  process.cwd(),
  'prisma/migrations/20260827000000_normalize_blank_user_names/migration.sql',
);

afterAll(async () => {
  await cleanupFixtures();
});

describe('normalize_blank_user_names migration', () => {
  it('normalizes blank User.name to NULL and leaves real names untouched', async () => {
    const blank = await createTestUser({ name: '' });
    const whitespace = await createTestUser({ name: '   ' });
    const real = await createTestUser({ name: 'Ada Lovelace' });

    const sql = await readFile(MIGRATION_SQL_PATH, 'utf-8');
    for (const statement of sql
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean))
      await prisma.$executeRawUnsafe(statement);

    const rows = await prisma.user.findMany({
      where: { id: { in: [blank.id, whitespace.id, real.id] } },
      select: { id: true, name: true },
    });
    const byId = new Map(rows.map((r) => [r.id, r.name]));
    expect(byId.get(blank.id)).toBeNull();
    expect(byId.get(whitespace.id)).toBeNull();
    expect(byId.get(real.id)).toBe('Ada Lovelace');
  });
});

describe('write-path invariant regression guards', () => {
  it('createUser stores NULL for a whitespace-only name', async () => {
    const admin = await createTestUser({ isAdmin: true });
    actAs(admin);
    const email = `${TEST_PREFIX}${randomUUID()}@example.com`;

    const result = await createUser({ email, name: '   ' });
    expect(result).toBeUndefined();

    const created = await prisma.user.findUniqueOrThrow({
      where: { email },
      select: { name: true },
    });
    expect(created.name).toBeNull();
  });

  it('setUserName rejects a whitespace-only name and leaves the row untouched', async () => {
    const user: User = await createTestUser({ name: 'Original Name' });
    actAs(user);

    const result = await setUserName({ name: '   ' });
    expect(result).toEqual({ error: 'Enter your full name.' });

    const unchanged = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { name: true },
    });
    expect(unchanged.name).toBe('Original Name');
  });
});
