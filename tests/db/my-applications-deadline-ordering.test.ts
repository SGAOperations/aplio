import {
  cleanupFixtures,
  createTestApplication,
  createTestPosition,
  createTestUser,
} from '@/tests/helpers/fixtures';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Application, User } from '@/prisma/client';
import {
  getClosingSoonDraftCount,
  getRecentMyApplications,
} from '@/prisma/data/applications';

// Fixed anchor so the fixtures' relative offsets never straddle a boundary.
const NOW = new Date('2026-08-15T12:00:00Z');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const OLD = new Date(NOW.getTime() - 21 * DAY);

let applicant: User;

let draftUrgent: Application;
let draftSoonOld: Application;
let draftPastDue: Application;
let draftNotYetOpen: Application;
let draftUnpublishedPosition: Application;
let draftDeletedPosition: Application;
let submittedRecent: Application;

beforeAll(async () => {
  const admin = await createTestUser({ isAdmin: true });
  applicant = await createTestUser();

  const posUrgent = await createTestPosition(admin, {
    status: 'open',
    closesAt: new Date(NOW.getTime() + 10 * HOUR),
  });
  const posSoon = await createTestPosition(admin, {
    status: 'open',
    closesAt: new Date(NOW.getTime() + 2 * DAY),
  });
  const posPastDue = await createTestPosition(admin, {
    status: 'open',
    closesAt: new Date(NOW.getTime() - 1 * DAY),
  });
  const posNotYetOpen = await createTestPosition(admin, {
    status: 'open',
    opensAt: new Date(NOW.getTime() + 1 * DAY),
    closesAt: new Date(NOW.getTime() + 3 * DAY),
  });
  const posUnpublished = await createTestPosition(admin, {
    status: 'draft',
    closesAt: new Date(NOW.getTime() + 2 * DAY),
  });
  const posDeleted = await createTestPosition(admin, {
    status: 'open',
    closesAt: new Date(NOW.getTime() + 2 * DAY),
    deletedAt: new Date(NOW.getTime() - 1 * HOUR),
  });
  const posRecent = await createTestPosition(admin, { status: 'open' });

  // Fresh submittedAt (default now()) so it also qualifies for the recency
  // query — the row this ticket's dedupe must collapse to one entry.
  draftUrgent = await createTestApplication(applicant, posUrgent, {
    status: 'draft',
  });
  // Created three weeks ago — the exact bug this ticket fixes: a stale
  // submittedAt would otherwise sink this row out of a take-bounded recency query.
  draftSoonOld = await createTestApplication(applicant, posSoon, {
    status: 'draft',
    submittedAt: OLD,
    createdAt: OLD,
  });
  draftPastDue = await createTestApplication(applicant, posPastDue, {
    status: 'draft',
  });
  draftNotYetOpen = await createTestApplication(applicant, posNotYetOpen, {
    status: 'draft',
  });
  draftUnpublishedPosition = await createTestApplication(
    applicant,
    posUnpublished,
    { status: 'draft' },
  );
  draftDeletedPosition = await createTestApplication(applicant, posDeleted, {
    status: 'draft',
  });
  submittedRecent = await createTestApplication(applicant, posRecent, {
    status: 'applied',
    submittedAt: NOW,
  });
});

afterAll(async () => {
  await cleanupFixtures();
});

describe('getRecentMyApplications', () => {
  it('floats at-risk drafts ahead of recency order, nearest deadline first', async () => {
    const rows = await getRecentMyApplications(applicant.id, 10, NOW);
    const ids = rows.map((r) => r.id);
    expect(ids.slice(0, 2)).toEqual([draftUrgent.id, draftSoonOld.id]);
  });

  it('dedupes a row that qualifies for both the at-risk and recency queries', async () => {
    const rows = await getRecentMyApplications(applicant.id, 10, NOW);
    const occurrences = rows.filter((r) => r.id === draftUrgent.id).length;
    expect(occurrences).toBe(1);
  });

  it('respects take, keeping the nearest at-risk drafts first', async () => {
    const rows = await getRecentMyApplications(applicant.id, 2, NOW);
    expect(rows.map((r) => r.id)).toEqual([draftUrgent.id, draftSoonOld.id]);
  });

  it('excludes a past-due draft from the float', async () => {
    const rows = await getRecentMyApplications(applicant.id, 10, NOW);
    expect(rows.slice(0, 2).map((r) => r.id)).not.toContain(draftPastDue.id);
  });

  it('excludes a not-yet-open draft from the float', async () => {
    const rows = await getRecentMyApplications(applicant.id, 10, NOW);
    expect(rows.slice(0, 2).map((r) => r.id)).not.toContain(draftNotYetOpen.id);
  });

  it('excludes drafts on unpublished or soft-deleted positions from the float', async () => {
    const rows = await getRecentMyApplications(applicant.id, 10, NOW);
    const floated = rows.slice(0, 2).map((r) => r.id);
    expect(floated).not.toContain(draftUnpublishedPosition.id);
    expect(floated).not.toContain(draftDeletedPosition.id);
  });

  it('still includes recency rows after the float', async () => {
    const rows = await getRecentMyApplications(applicant.id, 10, NOW);
    expect(rows.map((r) => r.id)).toContain(submittedRecent.id);
  });
});

describe('getClosingSoonDraftCount', () => {
  // 2, not 6 — the other four drafts (past-due, not-yet-open, unpublished,
  // soft-deleted) share buildAtRiskDraftWhere with the float above, so a
  // count that disagreed with it would be a drift bug, not a design choice.
  it('counts only the at-risk drafts, matching the float', async () => {
    expect(await getClosingSoonDraftCount(applicant.id, NOW)).toBe(2);
  });
});
