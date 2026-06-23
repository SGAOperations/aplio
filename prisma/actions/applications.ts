'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import type {
  Application,
  GlobalAnswer,
  GlobalApplicationAnswer,
  GlobalQuestion,
  PositionApplicationAnswer,
} from '@/prisma/client';

import { getCurrentUser } from '@/lib/auth/server';
import { MANAGEABLE_APPLICATION_STATUSES } from '@/lib/constants';
import prisma from '@/lib/prisma';
import { type DraftApplication } from '@/lib/types';
import { type ResponseType, toStringArray } from '@/lib/utils';

type GlobalAnswerWithQuestion = GlobalAnswer & {
  globalQuestion: GlobalQuestion;
};

const createDraftApplicationSchema = z.object({
  positionId: z.string().min(1),
});

const createOrUpdateApplicationAnswerSchema = z.object({
  applicationId: z.string().min(1),
  questionId: z.string().min(1),
  questionLabel: z.string().min(1),
  value: z.array(z.string()),
  isGlobal: z.boolean(),
});

const submitApplicationSchema = z.object({ applicationId: z.string().min(1) });

export async function createDraftApplication(
  positionId: string,
): Promise<ResponseType<DraftApplication>> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  const parsed = createDraftApplicationSchema.safeParse({ positionId });
  if (!parsed.success) return { error: 'Invalid input' };

  return prisma.$transaction(async (tx) => {
    const existing = await tx.application.findUnique({
      where: {
        userId_positionId: {
          userId: currentUser.id,
          positionId: parsed.data.positionId,
        },
      },
      include: { globalAnswers: true, positionAnswers: true },
    });

    if (existing) return existing;

    const globalAnswers = await tx.globalAnswer.findMany({
      where: { userId: currentUser.id, deletedAt: null },
      include: { globalQuestion: true },
    });

    return tx.application.create({
      data: {
        userId: currentUser.id,
        positionId: parsed.data.positionId,
        status: 'draft',
        createdById: currentUser.id,
        updatedById: currentUser.id,
        globalAnswers: {
          create: globalAnswers.map((answer: GlobalAnswerWithQuestion) => ({
            globalQuestionId: answer.globalQuestionId,
            questionLabel: answer.globalQuestion.label,
            value: answer.value,
            createdById: currentUser.id,
            updatedById: currentUser.id,
          })),
        },
      },
      include: { globalAnswers: true, positionAnswers: true },
    });
  });
}

export async function createOrUpdateApplicationAnswer(params: {
  applicationId: string;
  questionId: string;
  questionLabel: string;
  value: string[];
  isGlobal: boolean;
}): Promise<ResponseType<GlobalApplicationAnswer | PositionApplicationAnswer>> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  const parsed = createOrUpdateApplicationAnswerSchema.safeParse(params);
  if (!parsed.success) return { error: 'Invalid input' };

  const { applicationId, questionId, questionLabel, value, isGlobal } =
    parsed.data;

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { userId: true, positionId: true },
  });

  if (!application || application.userId !== currentUser.id)
    return { error: 'Unauthorized' };

  if (isGlobal) {
    const result = await prisma.globalApplicationAnswer.upsert({
      where: {
        applicationId_globalQuestionId: {
          applicationId,
          globalQuestionId: questionId,
        },
      },
      update: { value, updatedById: currentUser.id },
      create: {
        applicationId,
        globalQuestionId: questionId,
        questionLabel,
        value,
        createdById: currentUser.id,
        updatedById: currentUser.id,
      },
    });
    revalidatePath(`/positions/${application.positionId}/apply`);
    return result;
  }

  const result = await prisma.positionApplicationAnswer.upsert({
    where: {
      applicationId_positionQuestionId: {
        applicationId,
        positionQuestionId: questionId,
      },
    },
    update: { value, updatedById: currentUser.id },
    create: {
      applicationId,
      positionQuestionId: questionId,
      questionLabel,
      value,
      createdById: currentUser.id,
      updatedById: currentUser.id,
    },
  });
  revalidatePath(`/positions/${application.positionId}/apply`);
  return result;
}

export async function submitApplication(
  applicationId: string,
): Promise<ResponseType<Application>> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  const parsed = submitApplicationSchema.safeParse({ applicationId });
  if (!parsed.success) return { error: 'Invalid input' };

  const application = await prisma.application.findUnique({
    where: { id: parsed.data.applicationId },
    include: {
      globalAnswers: true,
      positionAnswers: true,
      position: { include: { questions: { where: { deletedAt: null } } } },
    },
  });

  if (!application || application.userId !== currentUser.id)
    return { error: 'Unauthorized' };

  const requiredGlobalQuestions = await prisma.globalQuestion.findMany({
    where: { required: true, deletedAt: null },
  });

  const hasUnansweredGlobal = requiredGlobalQuestions.some(
    (q) =>
      !application.globalAnswers.some(
        (a) => a.globalQuestionId === q.id && toStringArray(a.value).length > 0,
      ),
  );

  if (hasUnansweredGlobal)
    return {
      error: 'Please answer all required profile questions before submitting.',
    };

  const hasUnansweredPosition = application.position.questions.some(
    (q) =>
      q.required &&
      !application.positionAnswers.some(
        (a) =>
          a.positionQuestionId === q.id && toStringArray(a.value).length > 0,
      ),
  );

  if (hasUnansweredPosition)
    return { error: 'Please answer all required questions before submitting.' };

  const updated = await prisma.application.update({
    where: { id: parsed.data.applicationId },
    data: {
      status: 'applied',
      submittedAt: new Date(),
      updatedById: currentUser.id,
    },
  });
  revalidatePath('/applications');
  revalidatePath('/positions');
  return updated;
}

const updateApplicationStatusSchema = z.object({
  applicationId: z.string().min(1),
  status: z.enum(MANAGEABLE_APPLICATION_STATUSES),
});

// Throw-only: every failure here is unexpected/impossible from a correctly-gated UI.
// The applications page redirects unauthenticated and wrong-role users before
// the dropdown renders, so unauthenticated calls and wrong-role calls are impossible
// from the real UI. Forged inputs, stale ids, and DB faults all throw.
export async function updateApplicationStatus(input: unknown): Promise<void> {
  // getCurrentUser redirects unauthenticated callers — never returns null.
  const currentUser = await getCurrentUser();

  // Impossible from a correct UI — a failure here means malformed/forged input → throw.
  const parsed = updateApplicationStatusSchema.safeParse(input);
  if (!parsed.success) throw new Error('Invalid updateApplicationStatus input');
  const { applicationId, status } = parsed.data;

  // Authorization (no IDOR): scope the lookup to the application with manager filter
  // scoped to the caller so a non-admin non-manager cannot reach this record.
  const application = await prisma.application.findFirst({
    where: { id: applicationId, deletedAt: null, status: { not: 'draft' } },
    select: {
      id: true,
      positionId: true,
      position: {
        select: {
          managers: { where: { id: currentUser.id }, select: { id: true } },
        },
      },
    },
  });
  // Impossible from a correct UI: the list only renders submitted applications
  // of an accessible position — a miss means a forged/stale id → throw.
  if (!application) throw new Error('Application not found');

  // Wrong role is impossible from the UI (the page redirects such users before
  // the dropdown renders) → throw, not { error }.
  const isManager = application.position.managers.length > 0;
  if (!currentUser.isAdmin && !isManager)
    throw new Error('Not authorized to manage this application');

  await prisma.application.update({
    where: { id: applicationId },
    data: { status, updatedById: currentUser.id },
  });

  revalidatePath(`/positions/${application.positionId}/applications`);
}
