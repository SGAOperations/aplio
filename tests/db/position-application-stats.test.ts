import {
  cleanupFixtures,
  createTestApplication,
  createTestPosition,
  createTestUser,
} from '@/tests/helpers/fixtures';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Position, User } from '@/prisma/client';
import { getPositionApplicationStats } from '@/prisma/data/applications';

import { APPLICATION_STATUS_VALUES } from '@/lib/constants';

let admin: User;

let fullPosition: Position;
let noApplicationsPosition: Position;
let deletedPosition: Position;
let draftPosition: Position;

beforeAll(async () => {
  admin = await createTestUser({ isAdmin: true });

  fullPosition = await createTestPosition(admin);
  noApplicationsPosition = await createTestPosition(admin);
  deletedPosition = await createTestPosition(admin, { deletedAt: new Date() });
  draftPosition = await createTestPosition(admin, { status: 'draft' });

  for (const status of APPLICATION_STATUS_VALUES) {
    const applicant = await createTestUser();
    await createTestApplication(applicant, fullPosition, { status });
  }

  const deletedDraftApplicant = await createTestUser();
  await createTestApplication(deletedDraftApplicant, fullPosition, {
    status: 'draft',
    deletedAt: new Date(),
  });

  const deletedPositionApplicant = await createTestUser();
  await createTestApplication(deletedPositionApplicant, deletedPosition, {
    status: 'applied',
  });

  const draftPositionApplicant = await createTestUser();
  await createTestApplication(draftPositionApplicant, draftPosition, {
    status: 'applied',
  });
});

afterAll(async () => {
  await cleanupFixtures();
});

describe('getPositionApplicationStats', () => {
  it('counts every status once and totals just the pipeline six', async () => {
    const map = await getPositionApplicationStats([fullPosition.id]);
    const stats = map.get(fullPosition.id);
    expect(stats).toBeDefined();
    for (const status of APPLICATION_STATUS_VALUES)
      expect(stats?.counts[status]).toBe(1);
    expect(stats?.total).toBe(6);
  });

  it('excludes a soft-deleted draft from counts', async () => {
    const map = await getPositionApplicationStats([fullPosition.id]);
    const stats = map.get(fullPosition.id);
    expect(stats?.counts.draft).toBe(1);
  });

  it('returns a zeroed entry for a soft-deleted position', async () => {
    const map = await getPositionApplicationStats([deletedPosition.id]);
    const stats = map.get(deletedPosition.id);
    expect(stats).toEqual({
      positionId: deletedPosition.id,
      counts: {},
      total: 0,
    });
  });

  it('returns a zeroed entry for a position with no applications', async () => {
    const map = await getPositionApplicationStats([noApplicationsPosition.id]);
    expect(map.get(noApplicationsPosition.id)).toEqual({
      positionId: noApplicationsPosition.id,
      counts: {},
      total: 0,
    });
  });

  it('still counts applications on a draft-status position', async () => {
    const map = await getPositionApplicationStats([draftPosition.id]);
    expect(map.get(draftPosition.id)?.counts.applied).toBe(1);
  });

  it('returns an empty map for an empty input', async () => {
    expect(await getPositionApplicationStats([])).toEqual(new Map());
  });
});
