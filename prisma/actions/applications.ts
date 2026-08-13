'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod/v4';

import { cleanupOrphanedBlob } from '@/prisma/actions/question-files';
import type {
  Application,
  GlobalAnswer,
  GlobalApplicationAnswer,
  GlobalQuestion,
  PositionApplicationAnswer,
  Prisma,
} from '@/prisma/client';

import { requireOwnership } from '@/lib/auth/guards';
import { getCurrentUser } from '@/lib/auth/server';
import {
  NON_REVIEWABLE_APPLICATION_STATUSES,
  PUBLISHED_POSITION_WHERE,
  REVIEWER_APPLICATION_STATUSES,
  SHORT_ANSWER_FORMAT_ERROR_MESSAGES,
  TERMINAL_DECISION_STATUSES,
  matchesShortAnswerFormat,
} from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { type DraftApplication } from '@/lib/types';
import {
  type ResponseType,
  isAcceptingApplications,
  isError,
  toStringArray,
} from '@/lib/utils';

type GlobalAnswerWithQuestion = GlobalAnswer & {
  globalQuestion: GlobalQuestion;
};

// Shared by submitApplication (via syncGlobalAnswersFromProfile) and directly
// by submitApplication's own position-question check — kept small and
// file-private since only submitApplication re-validates position questions
// (reopenApplication deliberately does not, see its own comment).
function hasUnansweredRequiredPosition(
  positionAnswers: PositionApplicationAnswer[],
  questions: { id: string; required: boolean }[],
): boolean {
  return questions.some(
    (q) =>
      q.required &&
      !positionAnswers.some(
        (a) =>
          a.positionQuestionId === q.id && toStringArray(a.value).length > 0,
      ),
  );
}

// Backfills a snapshot row from the profile for any question missing one;
// never touches a row that already exists, so a cleared answer stays cleared.
async function syncGlobalAnswersFromProfile(
  tx: Prisma.TransactionClient,
  applicationId: string,
  userId: string,
): Promise<string[]> {
  const [questions, existingAnswers] = await Promise.all([
    tx.globalQuestion.findMany({
      where: { deletedAt: null },
      orderBy: { order: 'asc' },
      include: { answers: { where: { userId, deletedAt: null } } },
    }),
    tx.globalApplicationAnswer.findMany({
      where: { applicationId },
      select: { globalQuestionId: true, value: true },
    }),
  ]);

  const existingByQuestionId = new Map(
    existingAnswers.map((a) => [a.globalQuestionId, a.value]),
  );

  const toBackfill = questions.filter(
    (q) =>
      !existingByQuestionId.has(q.id) &&
      toStringArray(q.answers[0]?.value).length > 0,
  );

  if (toBackfill.length > 0) {
    await tx.globalApplicationAnswer.createMany({
      data: toBackfill.map((q) => ({
        applicationId,
        globalQuestionId: q.id,
        questionLabel: q.label,
        value: q.answers[0]!.value,
        createdById: userId,
        updatedById: userId,
      })),
      // Guards a race between two tabs backfilling the same question
      // concurrently — @@unique([applicationId, globalQuestionId]).
      skipDuplicates: true,
    });
  }

  const backfilledIds = new Set(toBackfill.map((q) => q.id));

  return questions
    .filter(
      (q) =>
        q.required &&
        !backfilledIds.has(q.id) &&
        toStringArray(existingByQuestionId.get(q.id)).length === 0,
    )
    .map((q) => q.label);
}

// A toast must stay readable when an admin adds several questions at once —
// caps the named list at three labels.
function formatMissingQuestions(labels: string[]): string {
  if (labels.length <= 3) return labels.join(', ');
  return `${labels.slice(0, 3).join(', ')} and ${labels.length - 3} more`;
}

const createDraftApplicationSchema = z.object({
  positionId: z.string().min(1),
});

const applicationIdSchema = z.object({ applicationId: z.string().min(1) });

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

  const parsed = createDraftApplicationSchema.safeParse({ positionId });
  if (!parsed.success) return { error: 'Invalid input' };

  // One `now` across the transaction and the window checks.
  const now = new Date();

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

    // Existing drafts survive a closed window; submit is what blocks.
    if (existing) return existing;

    // Server-trusted window gate before a draft is created.
    const position = await tx.position.findUnique({
      where: { id: parsed.data.positionId, deletedAt: null },
      select: { status: true, opensAt: true, closesAt: true },
    });

    if (!position) return { error: 'This position is no longer available.' };
    if (!isAcceptingApplications(position, now))
      return { error: 'This position is no longer accepting applications.' };

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

  const parsed = createOrUpdateApplicationAnswerSchema.safeParse(params);
  if (!parsed.success) return { error: 'Invalid input' };

  const { applicationId, questionId, questionLabel, value, isGlobal } =
    parsed.data;

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { userId: true, positionId: true },
  });

  requireOwnership(application, currentUser.id);

  // The client's on-blur check is UX only, and bypassable.
  const question = isGlobal
    ? await prisma.globalQuestion.findUnique({
        where: { id: questionId },
        select: { type: true, format: true },
      })
    : await prisma.positionQuestion.findUnique({
        where: { id: questionId },
        select: { type: true, format: true },
      });
  if (!question) throw new Error('Question not found');

  if (
    question.type === 'short_answer' &&
    question.format &&
    value[0] &&
    !matchesShortAnswerFormat(value[0], question.format)
  )
    return { error: SHORT_ANSWER_FORMAT_ERROR_MESSAGES[question.format] };

  // matchesShortAnswerFormat trims internally, so save the trimmed value.
  const persistedValue =
    question.type === 'short_answer' && question.format
      ? value.map((v) => v.trim())
      : value;

  if (isGlobal) {
    // Never trust a client blob URL — copy the caller's own profile value.
    const globalPersistedValue =
      question.type === 'file_upload'
        ? ((
            await prisma.globalAnswer.findUnique({
              where: {
                userId_globalQuestionId: {
                  userId: currentUser.id,
                  globalQuestionId: questionId,
                },
              },
              select: { value: true },
            })
          )?.value ?? [])
        : persistedValue;

    const result = await prisma.globalApplicationAnswer.upsert({
      where: {
        applicationId_globalQuestionId: {
          applicationId,
          globalQuestionId: questionId,
        },
      },
      update: { value: globalPersistedValue, updatedById: currentUser.id },
      create: {
        applicationId,
        globalQuestionId: questionId,
        questionLabel,
        value: globalPersistedValue,
        createdById: currentUser.id,
        updatedById: currentUser.id,
      },
    });
    revalidatePath(`/positions/${application.positionId}/apply`);
    return result;
  }

  // Unreachable from the UI; file answers go through uploadQuestionFileAnswer.
  if (question.type === 'file_upload')
    throw new Error('Invalid question type for this action');

  const result = await prisma.positionApplicationAnswer.upsert({
    where: {
      applicationId_positionQuestionId: {
        applicationId,
        positionQuestionId: questionId,
      },
    },
    update: { value: persistedValue, updatedById: currentUser.id },
    create: {
      applicationId,
      positionQuestionId: questionId,
      questionLabel,
      value: persistedValue,
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

  const parsed = submitApplicationSchema.safeParse({ applicationId });
  if (!parsed.success) return { error: 'Invalid input' };

  // A transaction because this is now a read-then-write: the backfill inside
  // syncGlobalAnswersFromProfile and the status update must land atomically,
  // or two tabs could both backfill and race the status write.
  const result = await prisma.$transaction(async (tx) => {
    const application = await tx.application.findUnique({
      where: { id: parsed.data.applicationId },
      include: {
        positionAnswers: true,
        position: {
          select: {
            deletedAt: true,
            status: true,
            opensAt: true,
            closesAt: true,
            questions: { where: { deletedAt: null } },
          },
        },
      },
    });

    requireOwnership(application, currentUser.id);

    // Same copy as createDraftApplication's equivalent gate — a draft's position
    // can be soft-deleted after the draft was created, before submit.
    if (application.position.deletedAt !== null)
      return { error: 'This position is no longer available.' };

    // Window re-check: a window can close while a draft is open. Checked before
    // required-answer validation so a closed window gives the clearest message.
    if (!isAcceptingApplications(application.position))
      return { error: 'This position is no longer accepting applications.' };

    const missingGlobalLabels = await syncGlobalAnswersFromProfile(
      tx,
      application.id,
      currentUser.id,
    );
    if (missingGlobalLabels.length > 0)
      return {
        error: `Answer these required profile questions before submitting: ${formatMissingQuestions(missingGlobalLabels)}.`,
      };

    if (
      hasUnansweredRequiredPosition(
        application.positionAnswers,
        application.position.questions,
      )
    )
      return {
        error: 'Please answer all required questions before submitting.',
      };

    return tx.application.update({
      where: { id: parsed.data.applicationId },
      data: {
        status: 'applied',
        submittedAt: new Date(),
        updatedById: currentUser.id,
      },
    });
  });

  if (isError(result)) return result;

  revalidatePath('/applications');
  revalidatePath('/positions', 'layout');
  // The draft leaves /my-applications' draft-state list once submitted.
  revalidatePath('/my-applications');
  return result;
}

const updateApplicationStatusSchema = z.object({
  applicationId: z.string().min(1),
  status: z.enum(REVIEWER_APPLICATION_STATUSES),
});

export async function updateApplicationStatus(
  input: unknown,
): Promise<void | { error: string }> {
  const user = await getCurrentUser();

  const parsed = updateApplicationStatusSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { applicationId, status } = parsed.data;

  // Authorization folded into the query, as in getApplicationForReview.
  const where = user.isAdmin
    ? {
        id: applicationId,
        deletedAt: null,
        status: { notIn: NON_REVIEWABLE_APPLICATION_STATUSES },
        position: PUBLISHED_POSITION_WHERE,
      }
    : {
        id: applicationId,
        deletedAt: null,
        status: { notIn: NON_REVIEWABLE_APPLICATION_STATUSES },
        // Merge, don't overwrite — see prisma/data/applications.ts#buildBaseWhere.
        position: {
          ...PUBLISHED_POSITION_WHERE,
          managers: { some: { id: user.id } },
        },
      };

  const application = await prisma.application.findFirst({
    where,
    select: { id: true },
  });

  // IDOR-style miss, unreachable from the UI — throw, don't return.
  if (!application) throw new Error('Application not found or not authorized');

  await prisma.application.update({
    where: { id: applicationId },
    data: { status, updatedById: user.id },
  });

  revalidatePath(`/applications/${applicationId}`);
  revalidatePath('/applications');
}

const updateApplicationStatusesSchema = z.object({
  applicationIds: z.array(z.string().min(1)).min(1).max(100),
  status: z.enum(REVIEWER_APPLICATION_STATUSES),
});

// Authorization in the updateMany where, so the target set can't drift mid-write.
export async function updateApplicationStatuses(
  input: unknown,
): Promise<{ updated: number } | { error: string }> {
  const user = await getCurrentUser();

  const parsed = updateApplicationStatusesSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { applicationIds, status } = parsed.data;

  // The scoped where silently excludes forged and out-of-scope ids.
  const where = user.isAdmin
    ? {
        id: { in: applicationIds },
        deletedAt: null,
        status: { notIn: NON_REVIEWABLE_APPLICATION_STATUSES },
        position: PUBLISHED_POSITION_WHERE,
      }
    : {
        id: { in: applicationIds },
        deletedAt: null,
        status: { notIn: NON_REVIEWABLE_APPLICATION_STATUSES },
        // Merge, don't overwrite — see prisma/data/applications.ts#buildBaseWhere.
        position: {
          ...PUBLISHED_POSITION_WHERE,
          managers: { some: { id: user.id } },
        },
      };

  const result = await prisma.application.updateMany({
    where,
    data: { status, updatedById: user.id },
  });

  if (result.count === 0) return { error: 'No applications were updated.' };

  revalidatePath('/applications');
  // Wildcard segment: a bulk update has no individual positionIds to hand.
  revalidatePath('/applications/[id]', 'layout');

  return { updated: result.count };
}

export async function withdrawApplication(
  applicationId: string,
): Promise<ResponseType<void>> {
  const currentUser = await getCurrentUser();

  const parsed = applicationIdSchema.safeParse({ applicationId });
  if (!parsed.success) throw new Error('Invalid input');

  const result = await prisma.application.updateMany({
    where: {
      id: parsed.data.applicationId,
      userId: currentUser.id,
      deletedAt: null,
      status: { notIn: ['draft', 'withdrawn', ...TERMINAL_DECISION_STATUSES] },
    },
    data: { status: 'withdrawn', updatedById: currentUser.id },
  });

  if (result.count === 0)
    return { error: 'This application can no longer be withdrawn.' };

  revalidatePath('/my-applications');
  revalidatePath('/applications');
  revalidatePath('/positions', 'layout');
}

export async function reopenApplication(
  applicationId: string,
): Promise<ResponseType<void>> {
  const currentUser = await getCurrentUser();

  const parsed = applicationIdSchema.safeParse({ applicationId });
  if (!parsed.success) throw new Error('Invalid input');

  // One `now`, so reads inside the transaction can't drift apart.
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    // Inside the transaction, unlike submitApplication, to stay atomic.
    const application = await tx.application.findFirst({
      where: {
        id: parsed.data.applicationId,
        userId: currentUser.id,
        deletedAt: null,
        status: 'withdrawn',
      },
      select: {
        id: true,
        position: {
          select: {
            deletedAt: true,
            status: true,
            opensAt: true,
            closesAt: true,
          },
        },
      },
    });

    // Reachable from a stale tab, so a toast rather than a throw.
    if (!application)
      return { error: 'This application can no longer be re-opened.' };

    if (application.position.deletedAt !== null)
      return { error: 'This position is no longer available.' };

    // Covers draft, closed, before opensAt, and after closesAt.
    if (!isAcceptingApplications(application.position, now))
      return { error: 'This position is no longer accepting applications.' };

    // Position questions are not re-validated here — a withdrawn application
    // already passed them once, and any new position question is #398's
    // problem. Only the global snapshot can drift after a withdraw.
    const missingGlobalLabels = await syncGlobalAnswersFromProfile(
      tx,
      application.id,
      currentUser.id,
    );
    if (missingGlobalLabels.length > 0)
      return {
        error: `Answer these required profile questions in your profile before re-opening: ${formatMissingQuestions(missingGlobalLabels)}.`,
      };

    // updateMany keeps the read's where; count === 0 means a concurrent transition won.
    const updateResult = await tx.application.updateMany({
      where: {
        id: parsed.data.applicationId,
        userId: currentUser.id,
        deletedAt: null,
        status: 'withdrawn',
      },
      // submittedAt keeps the original submission time reviewers sort by.
      data: { status: 'applied', updatedById: currentUser.id },
    });

    if (updateResult.count === 0)
      return { error: 'This application can no longer be re-opened.' };
  });

  if (result && 'error' in result) return result;

  revalidatePath('/my-applications');
  revalidatePath('/applications');
  revalidatePath('/positions', 'layout');
}

export async function deleteDraftApplication(
  applicationId: string,
): Promise<ResponseType<void>> {
  const currentUser = await getCurrentUser();

  const parsed = applicationIdSchema.safeParse({ applicationId });
  if (!parsed.success) throw new Error('Invalid input');

  const id = parsed.data.applicationId;

  // Collected pre-delete so blobs can be reference-counted after commit.
  let fileUrls: string[] = [];

  const deleteResult = await prisma.$transaction(async (tx) => {
    const app = await tx.application.findFirst({
      where: { id, userId: currentUser.id, status: 'draft', deletedAt: null },
      select: { id: true },
    });

    if (!app) return { error: 'This draft can no longer be deleted.' };

    // file_upload only — other answers are plain text, never blob URLs.
    const [globalAnswers, positionAnswers] = await Promise.all([
      tx.globalApplicationAnswer.findMany({
        where: { applicationId: id, globalQuestion: { type: 'file_upload' } },
        select: { value: true },
      }),
      tx.positionApplicationAnswer.findMany({
        where: { applicationId: id, positionQuestion: { type: 'file_upload' } },
        select: { value: true },
      }),
    ]);
    fileUrls = [...globalAnswers, ...positionAnswers].flatMap((a) => a.value);

    await tx.globalApplicationAnswer.deleteMany({
      where: { applicationId: id },
    });
    await tx.positionApplicationAnswer.deleteMany({
      where: { applicationId: id },
    });
    await tx.application.delete({ where: { id } });
  });

  if (deleteResult && 'error' in deleteResult) return deleteResult;

  await Promise.all(fileUrls.map((url) => cleanupOrphanedBlob(url)));

  revalidatePath('/my-applications');
}
