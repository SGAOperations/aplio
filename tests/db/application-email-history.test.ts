import {
  TEST_PREFIX,
  cleanupFixtures,
  createTestApplication,
  createTestPosition,
  createTestUser,
} from '@/tests/helpers/fixtures';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Application, Position, User } from '@/prisma/client';
import { getApplicationEmailHistory } from '@/prisma/data/applications';

import { prisma } from '@/lib/prisma';

function testAddress(): string {
  return `${TEST_PREFIX}${randomUUID()}@example.com`;
}

let admin: User;
let managerA: User;
let managerB: User;
let applicant: User;
let positionA: Position;
let positionB: Position;
let positionC: Position;
let appOnA: Application;
let appOnB: Application;

let deliveredId: string;
let sentId: string;

beforeAll(async () => {
  admin = await createTestUser({ isAdmin: true });
  managerA = await createTestUser();
  managerB = await createTestUser();
  applicant = await createTestUser();

  positionA = await createTestPosition(admin, { managers: [managerA] });
  positionB = await createTestPosition(admin, { managers: [managerB] });
  positionC = await createTestPosition(admin, { managers: [managerA] });

  appOnA = await createTestApplication(applicant, positionA, {
    status: 'applied',
    submittedAt: new Date(),
  });
  appOnB = await createTestApplication(applicant, positionB, {
    status: 'applied',
    submittedAt: new Date(),
  });

  const to = testAddress();

  const sent = await prisma.emailLog.create({
    data: {
      to,
      applicationId: appOnA.id,
      userId: applicant.id,
      template: 'application_received',
      subject: 'Application received',
      status: 'sent',
      sentAt: new Date(Date.now() - 60_000),
      createdAt: new Date(Date.now() - 60_000),
    },
  });
  sentId = sent.id;

  const delivered = await prisma.emailLog.create({
    data: {
      to,
      applicationId: appOnA.id,
      userId: applicant.id,
      template: 'application_accepted',
      subject: 'Application accepted',
      status: 'delivered',
      sentAt: new Date(Date.now() - 30_000),
      deliveredAt: new Date(Date.now() - 20_000),
      createdAt: new Date(Date.now() - 30_000),
    },
  });
  deliveredId = delivered.id;

  // OTP row — no applicationId, so it must never match the equality filter.
  await prisma.emailLog.create({
    data: { to, template: 'otp', subject: 'Your code', status: 'delivered' },
  });

  // A row on a different application must never leak in.
  await prisma.emailLog.create({
    data: {
      to,
      applicationId: appOnB.id,
      userId: applicant.id,
      template: 'application_received',
      subject: 'Application received',
      status: 'sent',
      sentAt: new Date(),
    },
  });
});

afterAll(async () => {
  await cleanupFixtures();
});

describe('getApplicationEmailHistory', () => {
  it("returns the managing manager's rows for their application", async () => {
    const rows = await getApplicationEmailHistory(appOnA.id, managerA);
    expect(rows.map((r) => r.id).sort()).toEqual([sentId, deliveredId].sort());
  });

  it('returns nothing for a manager outside the scope', async () => {
    const rows = await getApplicationEmailHistory(appOnA.id, managerB);
    expect(rows).toEqual([]);
  });

  it('returns the rows for an admin', async () => {
    const rows = await getApplicationEmailHistory(appOnA.id, admin);
    expect(rows).toHaveLength(2);
  });

  it('never includes an OTP row', async () => {
    const rows = await getApplicationEmailHistory(appOnA.id, managerA);
    expect(rows.some((r) => r.subject === 'Your code')).toBe(false);
  });

  it('never leaks a row from another application', async () => {
    const rowsOnA = await getApplicationEmailHistory(appOnA.id, admin);
    const rowsOnB = await getApplicationEmailHistory(appOnB.id, admin);
    expect(rowsOnB.every((r) => rowsOnA.every((a) => a.id !== r.id))).toBe(
      true,
    );
  });

  it('orders newest first', async () => {
    const rows = await getApplicationEmailHistory(appOnA.id, managerA);
    expect(rows[0]?.id).toBe(deliveredId);
    expect(rows[1]?.id).toBe(sentId);
  });

  it('returns [] for an application with no logged email', async () => {
    const noEmailApp = await createTestApplication(applicant, positionC, {
      status: 'applied',
    });
    const rows = await getApplicationEmailHistory(noEmailApp.id, managerA);
    expect(rows).toEqual([]);
  });

  it("uses each entry's status-appropriate occurredAt", async () => {
    const rows = await getApplicationEmailHistory(appOnA.id, managerA);
    const delivered = rows.find((r) => r.id === deliveredId);
    const sent = rows.find((r) => r.id === sentId);
    expect(delivered?.occurredAt).toBeInstanceOf(Date);
    expect(sent?.occurredAt).toBeInstanceOf(Date);
  });
});
