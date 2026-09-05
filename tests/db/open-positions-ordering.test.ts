import {
  cleanupFixtures,
  createTestPosition,
  createTestUser,
} from '@/tests/helpers/fixtures';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Position, User } from '@/prisma/client';
import { getOpenPositions } from '@/prisma/data/positions';

const now = new Date();
const days = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

let admin: User;
let soon: Position;
let later: Position;
let tieA: Position;
let tieB: Position;
let undatedRecent: Position;
let undatedOld: Position;
let undatedNever: Position;
let draftPosition: Position;
let deletedPosition: Position;
let upcomingPosition: Position;

beforeAll(async () => {
  admin = await createTestUser({ isAdmin: true });

  soon = await createTestPosition(admin, { closesAt: days(1) });
  later = await createTestPosition(admin, { closesAt: days(30) });

  const tieOpensAt = days(-5);
  tieA = await createTestPosition(admin, {
    title: 'vitest-position-tie-a',
    closesAt: days(60),
    opensAt: tieOpensAt,
  });
  tieB = await createTestPosition(admin, {
    title: 'vitest-position-tie-b',
    closesAt: days(60),
    opensAt: tieOpensAt,
  });

  undatedRecent = await createTestPosition(admin, {
    closesAt: null,
    opensAt: days(-1),
  });
  undatedOld = await createTestPosition(admin, {
    closesAt: null,
    opensAt: days(-100),
  });
  undatedNever = await createTestPosition(admin, {
    closesAt: null,
    opensAt: null,
  });

  draftPosition = await createTestPosition(admin, { status: 'draft' });
  deletedPosition = await createTestPosition(admin, { deletedAt: new Date() });
  upcomingPosition = await createTestPosition(admin, { opensAt: days(5) });
});

afterAll(async () => {
  await cleanupFixtures();
});

describe('getOpenPositions ordering', () => {
  const fixtureIds = () => [
    soon.id,
    later.id,
    tieA.id,
    tieB.id,
    undatedRecent.id,
    undatedOld.id,
    undatedNever.id,
  ];

  it('orders positions with a closing date soonest first', async () => {
    const positions = await getOpenPositions();
    const ids = positions
      .map((p) => p.id)
      .filter((id) => [soon.id, later.id].includes(id));
    expect(ids).toEqual([soon.id, later.id]);
  });

  it('places undated positions after every dated position', async () => {
    const positions = await getOpenPositions();
    const filtered = positions.filter((p) => fixtureIds().includes(p.id));
    const lastDatedIndex = filtered.findIndex((p) => p.id === tieB.id);
    const firstUndatedIndex = filtered.findIndex(
      (p) => p.id === undatedRecent.id,
    );
    expect(firstUndatedIndex).toBeGreaterThan(lastDatedIndex);
  });

  it('orders undated positions by opensAt, most recent first', async () => {
    const positions = await getOpenPositions();
    const ids = positions
      .map((p) => p.id)
      .filter((id) =>
        [undatedRecent.id, undatedOld.id, undatedNever.id].includes(id),
      );
    expect(ids).toEqual([undatedRecent.id, undatedOld.id, undatedNever.id]);
  });

  it('falls back to title when closesAt and opensAt both tie', async () => {
    const positions = await getOpenPositions();
    const ids = positions
      .map((p) => p.id)
      .filter((id) => [tieA.id, tieB.id].includes(id));
    expect(ids).toEqual([tieA.id, tieB.id]);
  });

  it('matches the full expected sequence across the fixture set', async () => {
    const positions = await getOpenPositions();
    const ids = positions
      .map((p) => p.id)
      .filter((id) => fixtureIds().includes(id));
    expect(ids).toEqual(fixtureIds());
  });

  it('excludes drafts, soft-deleted, and upcoming positions', async () => {
    const positions = await getOpenPositions();
    const ids = positions.map((p) => p.id);
    expect(ids).not.toContain(draftPosition.id);
    expect(ids).not.toContain(deletedPosition.id);
    expect(ids).not.toContain(upcomingPosition.id);
  });
});
