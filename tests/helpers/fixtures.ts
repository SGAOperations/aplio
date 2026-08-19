import { randomUUID } from 'node:crypto';

import type {
  Application,
  GlobalQuestion,
  Position,
  PositionQuestion,
  Prisma,
  Session,
  User,
} from '@/prisma/client';

import { prisma } from '@/lib/prisma';

// Every fixture row's email/title/label carries this, so cleanup is a prefix delete.
export const TEST_PREFIX = 'vitest-';

export async function createTestUser(
  overrides: Partial<Prisma.UserCreateInput> = {},
): Promise<User> {
  return prisma.user.create({
    data: {
      email: `${TEST_PREFIX}${randomUUID()}@example.com`,
      name: 'Test User',
      isAdmin: false,
      ...overrides,
    },
  });
}

export async function createTestPosition(
  createdBy: User,
  overrides: Partial<Prisma.PositionUncheckedCreateInput> & {
    managers?: User[];
  } = {},
): Promise<Position> {
  const { managers, ...rest } = overrides;
  return prisma.position.create({
    data: {
      title: `${TEST_PREFIX}position-${randomUUID()}`,
      description: '',
      status: 'open',
      createdById: createdBy.id,
      updatedById: createdBy.id,
      ...rest,
      ...(managers
        ? { managers: { connect: managers.map((m) => ({ id: m.id })) } }
        : {}),
    },
  });
}

export async function createTestApplication(
  user: User,
  position: Position,
  overrides: Partial<Prisma.ApplicationUncheckedCreateInput> = {},
): Promise<Application> {
  return prisma.application.create({
    data: {
      userId: user.id,
      positionId: position.id,
      createdById: user.id,
      updatedById: user.id,
      ...overrides,
    },
  });
}

export async function createTestGlobalQuestion(
  createdBy: User,
  overrides: Partial<Prisma.GlobalQuestionUncheckedCreateInput> = {},
): Promise<GlobalQuestion> {
  return prisma.globalQuestion.create({
    data: {
      label: `${TEST_PREFIX}question-${randomUUID()}`,
      type: 'short_answer',
      required: true,
      order: 1,
      options: [],
      allowOther: false,
      createdById: createdBy.id,
      updatedById: createdBy.id,
      ...overrides,
    },
  });
}

export async function createTestPositionQuestion(
  position: Position,
  createdBy: User,
  overrides: Partial<Prisma.PositionQuestionUncheckedCreateInput> = {},
): Promise<PositionQuestion> {
  return prisma.positionQuestion.create({
    data: {
      positionId: position.id,
      label: `${TEST_PREFIX}question-${randomUUID()}`,
      type: 'short_answer',
      required: true,
      order: 1,
      options: [],
      allowOther: false,
      createdById: createdBy.id,
      updatedById: createdBy.id,
      ...overrides,
    },
  });
}

// Cascades on user delete (onDelete: Cascade), so cleanup needs no extra step.
export async function createTestSession(user: User): Promise<Session> {
  return prisma.session.create({
    data: {
      userId: user.id,
      token: `${TEST_PREFIX}${randomUUID()}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
}

// Neutralizes the profile-completeness check; question set isn't scoped to this run.
export async function answerAllRequiredGlobalQuestions(
  user: User,
): Promise<void> {
  const questions = await prisma.globalQuestion.findMany({
    where: { deletedAt: null, required: true },
  });

  await Promise.all(
    questions.map((q) => {
      const value = q.options.length > 0 ? [q.options[0]] : ['placeholder'];
      return prisma.globalAnswer.upsert({
        where: {
          userId_globalQuestionId: { userId: user.id, globalQuestionId: q.id },
        },
        update: { value },
        create: {
          userId: user.id,
          globalQuestionId: q.id,
          value,
          createdById: user.id,
          updatedById: user.id,
        },
      });
    }),
  );
}

// FK order: answers -> applications/questions -> positions -> users.
export async function cleanupFixtures(): Promise<void> {
  const testUser = { email: { startsWith: TEST_PREFIX } } as const;
  const testPosition = { title: { startsWith: TEST_PREFIX } } as const;
  const testGlobalQuestion = { label: { startsWith: TEST_PREFIX } } as const;

  await prisma.globalApplicationAnswer.deleteMany({
    where: {
      OR: [
        { application: { user: testUser } },
        { application: { position: testPosition } },
        { globalQuestion: testGlobalQuestion },
      ],
    },
  });

  await prisma.positionApplicationAnswer.deleteMany({
    where: {
      OR: [
        { application: { user: testUser } },
        { application: { position: testPosition } },
        { positionQuestion: { position: testPosition } },
      ],
    },
  });

  await prisma.globalAnswer.deleteMany({
    where: { OR: [{ user: testUser }, { globalQuestion: testGlobalQuestion }] },
  });

  await prisma.application.deleteMany({
    where: { OR: [{ user: testUser }, { position: testPosition }] },
  });

  await prisma.positionQuestion.deleteMany({
    where: { position: testPosition },
  });

  await prisma.globalQuestion.deleteMany({ where: testGlobalQuestion });

  await prisma.position.deleteMany({ where: testPosition });

  await prisma.user.deleteMany({ where: testUser });
}
