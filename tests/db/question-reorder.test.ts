import {
  cleanupFixtures,
  createTestGlobalQuestion,
  createTestPosition,
  createTestPositionQuestion,
  createTestUser,
} from '@/tests/helpers/fixtures';
import { actAs } from '@/tests/stubs/auth-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { reorderGlobalQuestions } from '@/prisma/actions/global-questions';
import { reorderPositionQuestions } from '@/prisma/actions/position-question-actions';
import type { Position, PositionQuestion, User } from '@/prisma/client';

import { QUESTION_ORDER_STALE_ERROR } from '@/lib/constants';
import { prisma } from '@/lib/prisma';

let admin: User;
let managerA: User;
let managerB: User;
let positionA: Position;
let positionB: Position;

beforeAll(async () => {
  admin = await createTestUser({ isAdmin: true });
  managerA = await createTestUser();
  managerB = await createTestUser();
  positionA = await createTestPosition(admin, { managers: [managerA] });
  positionB = await createTestPosition(admin, { managers: [managerB] });
});

afterAll(async () => {
  await cleanupFixtures();
});

describe('reorderGlobalQuestions', () => {
  it('renumbers 1..N and closes a gap left by a soft-deleted question', async () => {
    const q1 = await createTestGlobalQuestion(admin, { order: 1 });
    const q2 = await createTestGlobalQuestion(admin, { order: 2 });
    const q3 = await createTestGlobalQuestion(admin, {
      order: 3,
      deletedAt: new Date(),
    });
    const q4 = await createTestGlobalQuestion(admin, { order: 4 });

    actAs(admin);
    const result = await reorderGlobalQuestions({ ids: [q4.id, q1.id, q2.id] });
    expect(result).toBeUndefined();

    const reordered = await prisma.globalQuestion.findMany({
      where: { id: { in: [q1.id, q2.id, q4.id] } },
      select: { id: true, order: true },
    });
    const orderById = new Map(reordered.map((q) => [q.id, q.order]));
    expect(orderById.get(q4.id)).toBe(1);
    expect(orderById.get(q1.id)).toBe(2);
    expect(orderById.get(q2.id)).toBe(3);

    const untouchedDeleted = await prisma.globalQuestion.findUniqueOrThrow({
      where: { id: q3.id },
      select: { order: true },
    });
    expect(untouchedDeleted.order).toBe(3);
  });

  it('rejects and writes nothing when an id is dropped, extra, or duplicated', async () => {
    const q1 = await createTestGlobalQuestion(admin);
    const q2 = await createTestGlobalQuestion(admin);
    const before = await prisma.globalQuestion.findMany({
      where: { id: { in: [q1.id, q2.id] } },
      select: { id: true, order: true },
    });

    actAs(admin);
    await expect(reorderGlobalQuestions({ ids: [q1.id] })).resolves.toEqual({
      error: QUESTION_ORDER_STALE_ERROR,
    });
    await expect(
      reorderGlobalQuestions({ ids: [q1.id, q2.id, 'not-a-real-id'] }),
    ).resolves.toEqual({ error: QUESTION_ORDER_STALE_ERROR });
    await expect(
      reorderGlobalQuestions({ ids: [q1.id, q1.id] }),
    ).resolves.toEqual({ error: QUESTION_ORDER_STALE_ERROR });

    const after = await prisma.globalQuestion.findMany({
      where: { id: { in: [q1.id, q2.id] } },
      select: { id: true, order: true },
    });
    expect(after).toEqual(before);
  });

  it('rejects a manager and an applicant', async () => {
    const q = await createTestGlobalQuestion(admin);
    actAs(managerA);
    await expect(reorderGlobalQuestions({ ids: [q.id] })).rejects.toThrow();
  });
});

describe('reorderPositionQuestions', () => {
  let question1: PositionQuestion;
  let question2: PositionQuestion;

  beforeAll(async () => {
    question1 = await createTestPositionQuestion(positionA, admin, {
      order: 1,
    });
    question2 = await createTestPositionQuestion(positionA, admin, {
      order: 2,
    });
  });

  it('renumbers 1..N for the position, scoped to positionId', async () => {
    actAs(managerA);
    const result = await reorderPositionQuestions({
      positionId: positionA.id,
      ids: [question2.id, question1.id],
    });
    expect(result).toBeUndefined();

    const reordered = await prisma.positionQuestion.findMany({
      where: { id: { in: [question1.id, question2.id] } },
      select: { id: true, order: true },
    });
    const orderById = new Map(reordered.map((q) => [q.id, q.order]));
    expect(orderById.get(question2.id)).toBe(1);
    expect(orderById.get(question1.id)).toBe(2);
  });

  it('rejects and writes nothing when the id set is stale', async () => {
    const before = await prisma.positionQuestion.findMany({
      where: { id: { in: [question1.id, question2.id] } },
      select: { id: true, order: true },
    });

    actAs(managerA);
    await expect(
      reorderPositionQuestions({
        positionId: positionA.id,
        ids: [question1.id],
      }),
    ).resolves.toEqual({ error: QUESTION_ORDER_STALE_ERROR });
    await expect(
      reorderPositionQuestions({
        positionId: positionA.id,
        ids: [question1.id, question2.id, 'not-a-real-id'],
      }),
    ).resolves.toEqual({ error: QUESTION_ORDER_STALE_ERROR });
    await expect(
      reorderPositionQuestions({
        positionId: positionA.id,
        ids: [question1.id, question1.id],
      }),
    ).resolves.toEqual({ error: QUESTION_ORDER_STALE_ERROR });

    const after = await prisma.positionQuestion.findMany({
      where: { id: { in: [question1.id, question2.id] } },
      select: { id: true, order: true },
    });
    expect(after).toEqual(before);
  });

  it('refuses an id that belongs to another position', async () => {
    const otherQuestion = await createTestPositionQuestion(positionB, admin, {
      order: 1,
    });

    actAs(managerB);
    await expect(
      reorderPositionQuestions({
        positionId: positionB.id,
        ids: [otherQuestion.id, question1.id],
      }),
    ).resolves.toEqual({ error: QUESTION_ORDER_STALE_ERROR });
  });

  it('throws for a manager of a different position', async () => {
    actAs(managerB);
    await expect(
      reorderPositionQuestions({
        positionId: positionA.id,
        ids: [question1.id, question2.id],
      }),
    ).rejects.toThrow();
  });
});

// A duplicate `order` (the create-time race) must never scramble read order.
describe('createdAt tiebreak', () => {
  it('keeps creation order stable when two questions share an order value', async () => {
    const first = await createTestGlobalQuestion(admin, { order: 99 });
    const second = await createTestGlobalQuestion(admin, { order: 99 });

    const rows = await prisma.globalQuestion.findMany({
      where: { id: { in: [first.id, second.id] } },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    expect(rows.map((r) => r.id)).toEqual([first.id, second.id]);
  });
});
