import {
  cleanupFixtures,
  createTestApplication,
  createTestPosition,
  createTestUser,
} from '@/tests/helpers/fixtures';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Application, Position, User } from '@/prisma/client';
import { getApplicantOtherApplications } from '@/prisma/data/applications';

const now = new Date();
const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
const thirtyFiveDaysAgo = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);
const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);

let admin: User;
let managerA: User;
let managerB: User;
let applicant: User;
let positionA: Position;
let positionB: Position;
let positionC: Position;
let archivedPosition: Position;
let stillActivePosition: Position;
let staleUnresolvedPosition: Position;
let anchorApp: Application;
let otherOpenApp: Application;
let stillActiveApp: Application;

beforeAll(async () => {
  admin = await createTestUser({ isAdmin: true });
  managerA = await createTestUser();
  managerB = await createTestUser();
  applicant = await createTestUser();

  positionA = await createTestPosition(admin, { managers: [managerA] });
  positionB = await createTestPosition(admin, { managers: [managerB] });
  positionC = await createTestPosition(admin, { managers: [managerA] });
  archivedPosition = await createTestPosition(admin, {
    managers: [managerA],
    status: 'closed',
    closesAt: thirtyFiveDaysAgo,
  });
  stillActivePosition = await createTestPosition(admin, {
    managers: [managerA],
    status: 'closed',
    closesAt: thirtyFiveDaysAgo,
  });
  staleUnresolvedPosition = await createTestPosition(admin, {
    managers: [managerA],
    status: 'closed',
    closesAt: fortyDaysAgo,
  });

  anchorApp = await createTestApplication(applicant, positionA, {
    status: 'applied',
    submittedAt: now,
  });
  otherOpenApp = await createTestApplication(applicant, positionB, {
    status: 'reviewing',
    submittedAt: oneDayAgo,
  });
  // Draft applications are excluded regardless of position.
  await createTestApplication(applicant, positionC, { status: 'draft' });
  // Archived: closed, no unresolved applications, past the recency window.
  await createTestApplication(applicant, archivedPosition, {
    status: 'rejected',
    submittedAt: thirtyFiveDaysAgo,
  });
  // Closed months ago, unresolved, but a status event moved recently — stays active.
  stillActiveApp = await createTestApplication(applicant, stillActivePosition, {
    status: 'reviewing',
    submittedAt: thirtyFiveDaysAgo,
    statusEvents: {
      create: {
        from: 'applied',
        to: 'reviewing',
        changedById: managerA.id,
        createdAt: sevenDaysAgo,
      },
    },
  });
  // Closed months ago, unresolved, and nothing has moved in over 30 days — archives.
  await createTestApplication(applicant, staleUnresolvedPosition, {
    status: 'applied',
    submittedAt: fortyDaysAgo,
  });
});

afterAll(async () => {
  await cleanupFixtures();
});

describe('getApplicantOtherApplications', () => {
  it('returns no list when the caller is unauthorized for the anchor application', async () => {
    const rows = await getApplicantOtherApplications(anchorApp.id, managerB);
    expect(rows).toEqual([]);
  });

  it('shows a row for a position the caller does not manage, precise status, not managed', async () => {
    const rows = await getApplicantOtherApplications(anchorApp.id, managerA);
    const row = rows.find((r) => r.position.id === positionB.id);

    expect(row).toBeDefined();
    expect(row?.status).toBe('reviewing');
    expect(row?.canOpen).toBe(false);
  });

  it('marks a row openable for an admin and for the managing manager', async () => {
    const asAdmin = await getApplicantOtherApplications(anchorApp.id, admin);
    const adminRow = asAdmin.find((r) => r.position.id === positionB.id);
    expect(adminRow?.canOpen).toBe(true);

    const asManagerB = await getApplicantOtherApplications(
      otherOpenApp.id,
      managerB,
    );
    const managerBRow = asManagerB.find((r) => r.position.id === positionA.id);
    expect(managerBRow?.canOpen).toBe(false);
  });

  it('never includes drafts', async () => {
    const rows = await getApplicantOtherApplications(anchorApp.id, managerA);
    expect(rows.some((r) => r.position.id === positionC.id)).toBe(false);
  });

  it('never includes the application being viewed', async () => {
    const rows = await getApplicantOtherApplications(anchorApp.id, managerA);
    expect(rows.some((r) => r.id === anchorApp.id)).toBe(false);
  });

  it('excludes an archived position — closed, no unresolved apps, past the window', async () => {
    const rows = await getApplicantOtherApplications(anchorApp.id, managerA);
    expect(rows.some((r) => r.position.id === archivedPosition.id)).toBe(false);
  });

  it('includes a long-closed position with a recent status change, despite an unresolved application', async () => {
    const rows = await getApplicantOtherApplications(anchorApp.id, managerA);
    const row = rows.find((r) => r.position.id === stillActivePosition.id);
    expect(row).toBeDefined();
    expect(row?.id).toBe(stillActiveApp.id);
  });

  it('excludes a long-closed position whose unresolved application has stale activity', async () => {
    const rows = await getApplicantOtherApplications(anchorApp.id, managerA);
    expect(rows.some((r) => r.position.id === staleUnresolvedPosition.id)).toBe(
      false,
    );
  });

  it('orders newest first', async () => {
    const rows = await getApplicantOtherApplications(anchorApp.id, managerA);
    const ids = rows.map((r) => r.id);
    expect(ids.indexOf(otherOpenApp.id)).toBeLessThan(
      ids.indexOf(stillActiveApp.id),
    );
  });
});
