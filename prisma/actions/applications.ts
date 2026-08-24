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
import {
  buildApplicationScopeWhere,
  buildApplicationWhere,
} from '@/lib/auth/scopes';
import { getCurrentUser } from '@/lib/auth/server';
import {
  ANSWER_LONG_MAX_LENGTH,
  ANSWER_MAX_VALUES,
  APPLICANT_EDITABLE_APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  REVIEWER_APPLICATION_STATUSES,
  SHORT_ANSWER_FORMAT_ERROR_MESSAGES,
  TERMINAL_DECISION_STATUSES,
  getAnswerValueError,
  getApplicationStatusForwardSources,
  isAllowedApplicationStatusTransition,
  matchesShortAnswerFormat,
} from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { type AnswerQuestion } from '@/lib/types';
import {
  type ResponseType,
  formatAlternatives,
  isAcceptingApplications,
  isAnswered,
  isError,
  resolveGlobalAnswerValues,
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
              questionType: answer.globalQuestion.type,
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
        questionType: question.type,
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
      questionType: question.type,
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

  // Snapshot materialization and the status update must land atomically, or
  // two tabs could race the write.
  const result = await prisma.$transaction(async (tx) => {
    const application = await tx.application.findUnique({
      where: { id: parsed.data.applicationId },
      include: {
        globalAnswers: true,
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

    // Read, not write: resolve every global question's value without touching the DB.
    const [globalQuestions, profileAnswers] = await Promise.all([
      tx.globalQuestion.findMany({
        where: { deletedAt: null },
        orderBy: { order: 'asc' },
        select: {
          id: true,
          label: true,
          type: true,
          required: true,
          options: true,
          allowOther: true,
          format: true,
        },
      }),
      tx.globalAnswer.findMany({
        where: { userId: currentUser.id, deletedAt: null },
        select: { globalQuestionId: true, value: true },
      }),
    ]);

    const resolvedValues = resolveGlobalAnswerValues(
      globalQuestions.map((q) => q.id),
      application.globalAnswers,
      profileAnswers,
    );

    const missingGlobalLabels = globalQuestions
      .filter(
        (q) => q.required && !isAnswered(q, resolvedValues.get(q.id) ?? []),
      )
      .map((q) => q.label);
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

    // Materialize: only questions with no existing row and a non-empty
    // resolved value get one — an unanswered optional global still gets no row.
    const existingIds = new Set(
      application.globalAnswers.map((a) => a.globalQuestionId),
    );
    const toMaterialize = globalQuestions.filter(
      (q) =>
        !existingIds.has(q.id) && (resolvedValues.get(q.id)?.length ?? 0) > 0,
    );
    if (toMaterialize.length > 0) {
      await tx.globalApplicationAnswer.createMany({
        data: toMaterialize.map((q) => ({
          applicationId: application.id,
          globalQuestionId: q.id,
          questionLabel: q.label,
          questionType: q.type,
          value: resolvedValues.get(q.id)!,
          createdById: currentUser.id,
          updatedById: currentUser.id,
        })),
        // Guards two tabs materializing the same question concurrently.
        skipDuplicates: true,
      });
    }

    // CAS on the exact status just read, closing the check-then-write race
    // between the read above and this write (e.g. a concurrent second tab) —
    // and giving the event below a provably correct `from`.
    const updateResult = await tx.application.updateMany({
      where: {
        id: parsed.data.applicationId,
        userId: currentUser.id,
        deletedAt: null,
        status: application.status,
      },
      data: {
        status: 'applied',
        submittedAt: new Date(),
        // Snapshot, not a live join — see Application.applicantName.
        applicantName: currentUser.name,
        updatedById: currentUser.id,
      },
    });

    // "Refresh" not "withdraw" — this guards a concurrent submit, not a stale status.
    if (updateResult.count === 0)
      return {
        error:
          'This application has already been submitted. Refresh to see its current status.',
      };

    await tx.applicationStatusEvent.create({
      data: {
        applicationId: parsed.data.applicationId,
        from: application.status,
        to: 'applied',
        changedById: currentUser.id,
      },
    });
  });

  if (isError(result)) return result;

  revalidatePath('/applications');
  revalidatePath('/positions', 'layout');
  // The draft leaves /my-applications' draft-state list once submitted.
  revalidatePath('/my-applications');
  revalidatePath(`/my-applications/${applicationId}`);
}

const updateApplicationStatusSchema = z.object({
  applicationId: z.string().min(1),
  status: z.enum(REVIEWER_APPLICATION_STATUSES),
  // Bypasses isAllowedApplicationStatusTransition for the status dialog's
  // any-status Select and undo — target is still restricted to REVIEWER_APPLICATION_STATUSES above.
  override: z.boolean().optional().default(false),
});

export async function updateApplicationStatus(
  input: unknown,
): Promise<void | { error: string }> {
  const user = await getCurrentUser();

  const parsed = updateApplicationStatusSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { applicationId, status, override } = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    // Authorization folded into the query, as in getApplicationForReview.
    const application = await tx.application.findFirst({
      where: {
        id: applicationId,
        ...buildApplicationWhere(user, 'reviewable'),
      },
      select: { id: true, status: true },
    });

    // IDOR-style miss, unreachable from the UI — throw, don't return.
    if (!application)
      throw new Error('Application not found or not authorized');

    if (status === application.status)
      return {
        error: `This application is already ${APPLICATION_STATUS_LABELS[status]}.`,
      };

    if (
      !override &&
      !isAllowedApplicationStatusTransition(application.status, status)
    )
      return {
        error: `This application is now ${APPLICATION_STATUS_LABELS[application.status]}, so that move is no longer available. Refresh to see the current options.`,
      };

    // CAS on the exact status just read, so the event's `from` below is
    // provably the status that was replaced.
    const updateResult = await tx.application.updateMany({
      where: { id: applicationId, status: application.status },
      data: { status, updatedById: user.id },
    });

    if (updateResult.count === 0)
      return {
        error:
          'This application just changed. Refresh to see its current status.',
      };

    await tx.applicationStatusEvent.create({
      data: {
        applicationId,
        from: application.status,
        to: status,
        changedById: user.id,
      },
    });
  });

  if (result && 'error' in result) return result;

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
): Promise<{ updated: number; skipped: number } | { error: string }> {
  const user = await getCurrentUser();

  const parsed = updateApplicationStatusesSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  // `in` collapses duplicates, so dedupe first or skipped would be inflated.
  const applicationIds = Array.from(new Set(parsed.data.applicationIds));
  const { status } = parsed.data;

  const { eligible, updatedIds } = await prisma.$transaction(async (tx) => {
    // Forward-only sources so a bulk move-back can't silently walk an
    // already-decided row backward; captured with its status for the event's `from`.
    const eligible = await tx.application.findMany({
      where: {
        id: { in: applicationIds },
        ...buildApplicationScopeWhere(user),
        status: { in: getApplicationStatusForwardSources(status) },
      },
      select: { id: true, status: true },
    });

    if (eligible.length === 0) return { eligible, updatedIds: [] };

    // Per-row (id, status) pairs keep the CAS on the bulk path too — a
    // concurrently-moved row is dropped rather than getting a wrong `from`.
    const updated = await tx.application.updateManyAndReturn({
      where: {
        AND: [
          buildApplicationScopeWhere(user),
          {
            OR: eligible.map(({ id, status: from }) => ({ id, status: from })),
          },
        ],
      },
      data: { status, updatedById: user.id },
      select: { id: true },
    });

    if (updated.length > 0) {
      const priorStatusById = new Map(eligible.map((a) => [a.id, a.status]));
      await tx.applicationStatusEvent.createMany({
        data: updated.map((a) => ({
          applicationId: a.id,
          from: priorStatusById.get(a.id)!,
          to: status,
          changedById: user.id,
        })),
      });
    }

    return { eligible, updatedIds: updated.map((a) => a.id) };
  });

  if (eligible.length === 0) {
    const sourceLabels = getApplicationStatusForwardSources(status).map(
      (source) => APPLICATION_STATUS_LABELS[source],
    );
    return {
      error: `None of the selected applications can move to ${APPLICATION_STATUS_LABELS[status]} — that's only reachable from ${formatAlternatives(sourceLabels)}.`,
    };
  }

  revalidatePath('/applications');
  // Wildcard segment: a bulk update has no individual positionIds to hand.
  revalidatePath('/applications/[id]', 'layout');

  return {
    updated: updatedIds.length,
    skipped: applicationIds.length - updatedIds.length,
  };
}

const WITHDRAW_NOT_ALLOWED_MESSAGE =
  'This application can no longer be withdrawn.';

export async function withdrawApplication(
  applicationId: string,
): Promise<ResponseType<void>> {
  const currentUser = await getCurrentUser();

  const parsed = applicationIdSchema.safeParse({ applicationId });
  if (!parsed.success) throw new Error('Invalid input');

  const result = await prisma.$transaction(async (tx) => {
    const application = await tx.application.findFirst({
      where: {
        id: parsed.data.applicationId,
        userId: currentUser.id,
        deletedAt: null,
        status: {
          notIn: ['draft', 'withdrawn', ...TERMINAL_DECISION_STATUSES],
        },
      },
      select: { status: true },
    });

    if (!application) return { error: WITHDRAW_NOT_ALLOWED_MESSAGE };

    // CAS on the exact status just read, mirroring the other write paths.
    const updateResult = await tx.application.updateMany({
      where: {
        id: parsed.data.applicationId,
        userId: currentUser.id,
        status: application.status,
      },
      data: { status: 'withdrawn', updatedById: currentUser.id },
    });

    if (updateResult.count === 0)
      return { error: WITHDRAW_NOT_ALLOWED_MESSAGE };

    await tx.applicationStatusEvent.create({
      data: {
        applicationId: parsed.data.applicationId,
        from: application.status,
        to: 'withdrawn',
        changedById: currentUser.id,
      },
    });
  });

  if (result && 'error' in result) return result;

  revalidatePath('/my-applications');
  revalidatePath(`/my-applications/${applicationId}`);
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
        where: { applicationId: id, questionType: 'file_upload' },
        select: { value: true },
      }),
      tx.positionApplicationAnswer.findMany({
        where: { applicationId: id, questionType: 'file_upload' },
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
  revalidatePath(`/my-applications/${id}`);
}
