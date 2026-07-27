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
  toStringArray,
} from '@/lib/utils';

type GlobalAnswerWithQuestion = GlobalAnswer & {
  globalQuestion: GlobalQuestion;
};

type ApplicationForRequiredAnswers = {
  globalAnswers: GlobalApplicationAnswer[];
  positionAnswers: PositionApplicationAnswer[];
  position: { questions: { id: string; required: boolean }[] };
};

// Shared by submitApplication and reopenApplication so the two gates can't
// drift. Not exported — this file's 'use server' directive requires every
// export to be an async server action. Accepts a Prisma.TransactionClient
// (PrismaClient is structurally assignable) so callers can pass either the
// bare client or a transaction.
async function findMissingRequiredAnswers(
  client: Prisma.TransactionClient,
  application: ApplicationForRequiredAnswers,
): Promise<'global' | 'position' | null> {
  const requiredGlobalQuestions = await client.globalQuestion.findMany({
    where: { required: true, deletedAt: null },
  });

  const hasUnansweredGlobal = requiredGlobalQuestions.some(
    (q) =>
      !application.globalAnswers.some(
        (a) => a.globalQuestionId === q.id && toStringArray(a.value).length > 0,
      ),
  );
  if (hasUnansweredGlobal) return 'global';

  const hasUnansweredPosition = application.position.questions.some(
    (q) =>
      q.required &&
      !application.positionAnswers.some(
        (a) =>
          a.positionQuestionId === q.id && toStringArray(a.value).length > 0,
      ),
  );
  if (hasUnansweredPosition) return 'position';

  return null;
}

const createDraftApplicationSchema = z.object({
  positionId: z.string().min(1),
});

// Shared schema for actions that take a single application ID.
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

  // Use a single consistent `now` for both the transaction and any window checks.
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

    // Return an existing draft even if the window has since closed — the applicant
    // can still see their in-progress work; submitApplication will block the submit.
    if (existing) return existing;

    // Authoritative window gate: verify the position exists and is currently accepting
    // before creating a new draft. Reads server-trusted DB fields — no IDOR surface.
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

  // Re-validate the format preset server-side — the client's on-blur check
  // (application-stepper.tsx) is UX only and can be bypassed.
  const question = isGlobal
    ? await prisma.globalQuestion.findUnique({
        where: { id: questionId },
        select: { type: true, format: true },
      })
    : await prisma.positionQuestion.findUnique({
        where: { id: questionId },
        select: { type: true, format: true },
      });

  if (
    question?.type === 'short_answer' &&
    question.format &&
    value[0] &&
    !matchesShortAnswerFormat(value[0], question.format)
  )
    return { error: SHORT_ANSWER_FORMAT_ERROR_MESSAGES[question.format] };

  // Persist what was actually validated: matchesShortAnswerFormat trims
  // internally, so a format-validated answer must be trimmed before saving
  // too, or a pasted value with incidental whitespace saves verbatim.
  const persistedValue =
    question?.type === 'short_answer' && question.format
      ? value.map((v) => v.trim())
      : value;

  if (isGlobal) {
    const question = await prisma.globalQuestion.findUnique({
      where: { id: questionId },
      select: { type: true },
    });
    if (!question) throw new Error('Question not found');

    // file_upload answers are written exclusively by uploadQuestionFileAnswer /
    // removeQuestionFileAnswer (prisma/actions/question-files.ts) — never trust
    // a client-supplied blob URL here. This path only runs for the stepper's
    // "Use profile answers" revert, so always copy the caller's own current
    // profile value instead of whatever the client sent.
    const value =
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
        : parsed.data.value;

    const result = await prisma.globalApplicationAnswer.upsert({
      where: {
        applicationId_globalQuestionId: {
          applicationId,
          globalQuestionId: questionId,
        },
      },
      update: { value: persistedValue, updatedById: currentUser.id },
      create: {
        applicationId,
        globalQuestionId: questionId,
        questionLabel,
        value: persistedValue,
        createdById: currentUser.id,
        updatedById: currentUser.id,
      },
    });
    revalidatePath(`/positions/${application.positionId}/apply`);
    return result;
  }

  const question = await prisma.positionQuestion.findUnique({
    where: { id: questionId },
    select: { type: true },
  });
  if (!question) throw new Error('Question not found');
  // Not reachable from the UI — file_upload position answers can only be
  // written by uploadQuestionFileAnswer.
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

  const application = await prisma.application.findUnique({
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

  // Same copy as createDraftApplication's equivalent gate — a draft's position
  // can be soft-deleted after the draft was created, before submit.
  if (application.position.deletedAt !== null)
    return { error: 'This position is no longer available.' };

  // Window re-check: a window can close while a draft is open. Checked before
  // required-answer validation so a closed window gives the clearest message.
  if (!isAcceptingApplications(application.position))
    return { error: 'This position is no longer accepting applications.' };

  const missing = await findMissingRequiredAnswers(prisma, application);
  if (missing === 'global')
    return {
      error: 'Please answer all required profile questions before submitting.',
    };
  if (missing === 'position')
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
  status: z.enum(REVIEWER_APPLICATION_STATUSES),
});

export async function updateApplicationStatus(
  input: unknown,
): Promise<void | { error: string }> {
  const user = await getCurrentUser();

  const parsed = updateApplicationStatusSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { applicationId, status } = parsed.data;

  // Authorization folded into the query — same pattern as getApplicationForReview.
  // Returns null for non-existent, soft-deleted, withdrawn, draft/deleted-position,
  // or unauthorized callers.

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

  // Null here means non-existent, soft-deleted, withdrawn, or the caller has no
  // right to this application ID — an IDOR-style miss that should not be
  // reachable from the UI, so we throw rather than returning a user-facing error.
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

// Bulk status update for the /applications hub. Returns { updated: number } on
// success so the client can toast the real count. Returns { error } for
// user-facing failures (invalid input, no-op race). Throws for unexpected errors.
// Authorization is folded directly into the updateMany where — no separate
// findMany/updateMany pair, so there is no window for the target set to drift
// between an authorization check and the write.
export async function updateApplicationStatuses(
  input: unknown,
): Promise<{ updated: number } | { error: string }> {
  const user = await getCurrentUser();

  const parsed = updateApplicationStatusesSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { applicationIds, status } = parsed.data;

  // Authorize: scoped where clause means forged/deleted/out-of-scope/withdrawn
  // ids are silently excluded — the caller can only update records they may see,
  // mirroring the exclusion updateApplicationStatus enforces.
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
  // Clears all cached detail-page renders — bulk updates don't have individual
  // positionIds at hand, so the wildcard layout segment is the right scope.
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

  // Single `now` shared by the window check below, to avoid a race between
  // reads at slightly different instants inside the transaction.
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    // Ownership and source status are folded into the where clause (no IDOR
    // surface). Unlike submitApplication, this read-then-write runs inside
    // the $transaction below to keep the check and the update atomic.
    const application = await tx.application.findFirst({
      where: {
        id: parsed.data.applicationId,
        userId: currentUser.id,
        deletedAt: null,
        status: 'withdrawn',
      },
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

    // Not found / not owned / not withdrawn / a concurrent race. Reachable
    // normally from a stale /my-applications tab, so this stays a toast.
    if (!application)
      return { error: 'This application can no longer be re-opened.' };

    if (application.position.deletedAt !== null)
      return { error: 'This position is no longer available.' };

    // Covers draft, closed, before opensAt, and after closesAt.
    if (!isAcceptingApplications(application.position, now))
      return { error: 'This position is no longer accepting applications.' };

    const missing = await findMissingRequiredAnswers(tx, application);
    if (missing === 'global')
      return {
        error:
          'Answer all required profile questions before re-opening this application.',
      };
    if (missing === 'position')
      return {
        error:
          'Answer all required questions on this application before re-opening it.',
      };

    // updateMany (not update) to keep the same ownership/status where clause
    // as the read — count === 0 means a concurrent transition beat us here.
    const updateResult = await tx.application.updateMany({
      where: {
        id: parsed.data.applicationId,
        userId: currentUser.id,
        deletedAt: null,
        status: 'withdrawn',
      },
      // submittedAt is left untouched — it reflects the original submission
      // time reviewers sort by, not the re-open time.
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

  // Collected inside the transaction, before the rows are removed, so any
  // uploaded file answers can be reference-counted and cleaned up after commit.
  let fileUrls: string[] = [];

  const deleteResult = await prisma.$transaction(async (tx) => {
    const app = await tx.application.findFirst({
      where: { id, userId: currentUser.id, status: 'draft', deletedAt: null },
      select: { id: true },
    });

    if (!app) return { error: 'This draft can no longer be deleted.' };

    // Scoped to file_upload questions only — other answer values are plain
    // text, not blob URLs, and must never be sent to the Blob API.
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
