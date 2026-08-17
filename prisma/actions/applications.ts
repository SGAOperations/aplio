'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod/v4';

import { cleanupOrphanedBlob } from '@/prisma/actions/question-files';
import { Prisma } from '@/prisma/client';
import type {
  GlobalAnswer,
  GlobalApplicationAnswer,
  GlobalQuestion,
  PositionApplicationAnswer,
} from '@/prisma/client';

import { requireOwnership } from '@/lib/auth/guards';
import { getCurrentUser } from '@/lib/auth/server';
import {
  ANSWER_LONG_MAX_LENGTH,
  ANSWER_MAX_VALUES,
  APPLICANT_EDITABLE_APPLICATION_STATUSES,
  NON_REVIEWABLE_APPLICATION_STATUSES,
  PUBLISHED_POSITION_WHERE,
  REVIEWER_APPLICATION_STATUSES,
  SHORT_ANSWER_FORMAT_ERROR_MESSAGES,
  TERMINAL_DECISION_STATUSES,
  getAnswerValueError,
  matchesShortAnswerFormat,
} from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { type AnswerQuestion } from '@/lib/types';
import {
  type ResponseType,
  isAcceptingApplications,
  isAnswered,
  isError,
  toStringArray,
} from '@/lib/utils';

type GlobalAnswerWithQuestion = GlobalAnswer & {
  globalQuestion: GlobalQuestion;
};

// File-private, called only by submitApplication.
function hasUnansweredRequiredPosition(
  positionAnswers: PositionApplicationAnswer[],
  questions: AnswerQuestion[],
): boolean {
  return questions.some(
    (q) =>
      q.required &&
      !positionAnswers.some(
        (a) =>
          a.positionQuestionId === q.id &&
          isAnswered(q, toStringArray(a.value)),
      ),
  );
}

// Only backfills a missing row — an existing (possibly cleared) row is left alone.
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
      // Guards two tabs backfilling the same question concurrently.
      skipDuplicates: true,
    });
  }

  const backfilledIds = new Set(toBackfill.map((q) => q.id));

  return questions
    .filter(
      (q) =>
        q.required &&
        !backfilledIds.has(q.id) &&
        !isAnswered(q, toStringArray(existingByQuestionId.get(q.id))),
    )
    .map((q) => q.label);
}

// Keeps the toast readable when several questions are missing at once.
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
  // Pre-DB size guard only — getAnswerValueError below enforces the real limits.
  value: z.array(z.string().max(ANSWER_LONG_MAX_LENGTH)).max(ANSWER_MAX_VALUES),
});

const submitApplicationSchema = z.object({ applicationId: z.string().min(1) });

// Shared so callers don't distinguish which action rejected the write.
const APPLICATION_NOT_EDITABLE_MESSAGE =
  'This application has already been submitted. Withdraw it to make changes.';

// Interaction-time only — never called during render (see apply/page.tsx).
export async function createDraftApplication(
  input: unknown,
): Promise<void | { error: string }> {
  const currentUser = await getCurrentUser();

  const parsed = createDraftApplicationSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  // One `now` across the transaction and the window checks.
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    // Predicate must match getApplicationForApply's, or the two disagree on
    // whether a draft already exists.
    const existing = await tx.application.findUnique({
      where: {
        userId_positionId: {
          userId: currentUser.id,
          positionId: parsed.data.positionId,
        },
        deletedAt: null,
      },
      select: { id: true },
    });

    // Existing drafts survive a closed window; submit is what blocks. Already
    // having one is success, not an error — the page just re-reads it.
    if (existing) return;

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

    try {
      await tx.application.create({
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
      });
    } catch (error) {
      // Concurrent duplicate (two tabs racing the same create) — the other
      // tab's row already committed, so revalidate here too even though
      // this call reports the error: without it the losing tab never
      // refreshes and stays stuck on the entry card.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        revalidatePath(`/positions/${parsed.data.positionId}/apply`);
        revalidatePath('/my-applications');
        revalidatePath('/');
        return { error: 'You already have an application for this position.' };
      }
      throw error;
    }
  });

  if (result && 'error' in result) return result;

  revalidatePath(`/positions/${parsed.data.positionId}/apply`);
  revalidatePath('/my-applications');
  revalidatePath('/');
}

export async function createOrUpdateApplicationAnswer(params: {
  applicationId: string;
  questionId: string;
  value: string[];
}): Promise<ResponseType<GlobalApplicationAnswer | PositionApplicationAnswer>> {
  const currentUser = await getCurrentUser();

  const parsed = createOrUpdateApplicationAnswerSchema.safeParse(params);
  if (!parsed.success) return { error: 'Invalid input' };

  const { applicationId, questionId, value } = parsed.data;

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { userId: true, positionId: true, status: true },
  });

  requireOwnership(application, currentUser.id);

  if (
    !APPLICANT_EDITABLE_APPLICATION_STATUSES.includes(
      application.status as (typeof APPLICANT_EDITABLE_APPLICATION_STATUSES)[number],
    )
  )
    return { error: APPLICATION_NOT_EDITABLE_MESSAGE };

  // Label and scope must come from the DB, not the client — the label is the
  // reviewer-visible snapshot; ids are uuid(7), so at most one can match.
  const [globalQuestion, positionQuestion] = await Promise.all([
    prisma.globalQuestion.findFirst({
      where: { id: questionId, deletedAt: null },
      select: {
        label: true,
        type: true,
        format: true,
        options: true,
        allowOther: true,
      },
    }),
    prisma.positionQuestion.findFirst({
      where: {
        id: questionId,
        deletedAt: null,
        positionId: application.positionId,
      },
      select: {
        label: true,
        type: true,
        format: true,
        options: true,
        allowOther: true,
      },
    }),
  ]);
  const isGlobal = globalQuestion !== null;
  const question = globalQuestion ?? positionQuestion;
  if (!question) throw new Error('Question not found or not authorized');

  if (
    question.type === 'short_answer' &&
    question.format &&
    value[0] &&
    !matchesShortAnswerFormat(value[0], question.format)
  )
    return { error: SHORT_ANSWER_FORMAT_ERROR_MESSAGES[question.format] };

  // Membership, "how many values", and length-limit backstop.
  const answerError = getAnswerValueError(question, value);
  if (answerError) return { error: answerError };

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
        questionLabel: question.label,
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
      questionLabel: question.label,
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
): Promise<ResponseType<void>> {
  const currentUser = await getCurrentUser();

  const parsed = submitApplicationSchema.safeParse({ applicationId });
  if (!parsed.success) return { error: 'Invalid input' };

  // Backfill and status update must land atomically, or two tabs could race the write.
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

    // Status check first — wins over the window/required-answer checks below.
    if (
      !APPLICANT_EDITABLE_APPLICATION_STATUSES.includes(
        application.status as (typeof APPLICANT_EDITABLE_APPLICATION_STATUSES)[number],
      )
    )
      return { error: APPLICATION_NOT_EDITABLE_MESSAGE };

    // A draft's position can be soft-deleted after creation, before submit.
    if (application.position.deletedAt !== null)
      return { error: 'This position is no longer available.' };

    // Window can close while a draft sits open, so re-check here.
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

    // Status scoped again here, closing the check-then-write race between
    // the read above and this write (e.g. a concurrent second tab).
    const updateResult = await tx.application.updateMany({
      where: {
        id: parsed.data.applicationId,
        userId: currentUser.id,
        deletedAt: null,
        status: { in: APPLICANT_EDITABLE_APPLICATION_STATUSES },
      },
      data: {
        status: 'applied',
        submittedAt: new Date(),
        updatedById: currentUser.id,
      },
    });

    // "Refresh" not "withdraw" — this guards a concurrent submit, not a stale status.
    if (updateResult.count === 0)
      return {
        error:
          'This application has already been submitted. Refresh to see its current status.',
      };
  });

  if (isError(result)) return result;

  revalidatePath('/applications');
  revalidatePath('/positions', 'layout');
  // The draft leaves /my-applications' draft-state list once submitted.
  revalidatePath('/my-applications');
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
