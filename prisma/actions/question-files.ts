'use server';

import { revalidatePath } from 'next/cache';

import { del, get, put } from '@vercel/blob';
import { z } from 'zod/v4';

import type { Prisma } from '@/prisma/client';

import { getCurrentUser } from '@/lib/auth/server';
import {
  FILE_UPLOAD_MAX_BYTES,
  FILE_UPLOAD_MIME_EXTENSIONS,
  FILE_UPLOAD_MIME_TYPES,
  questionFileTargetSchema,
} from '@/lib/constants';
import {
  buildAnswerFilePathname,
  getFileDisplayName,
  sniffMimeType,
} from '@/lib/files';
import { prisma } from '@/lib/prisma';
import type { QuestionFileDownload, QuestionFileTarget } from '@/lib/types';
import { type ResponseType } from '@/lib/utils';

const GENERIC_TYPE_ERROR = 'Only PDF, PNG and JPG files are allowed.';
const SUBMITTED_ERROR = 'This application has already been submitted.';
const NOT_AVAILABLE_ERROR = 'This file is no longer available.';

// Signals the caller to surface SUBMITTED_ERROR rather than rethrow as unexpected.
class ApplicationSubmittedError extends Error {}

// Returned verbatim as user-facing copy; question-file-field.tsx mirrors them.
const fileSchema = z
  .file()
  .min(1, 'Select a file to upload.')
  .max(FILE_UPLOAD_MAX_BYTES, 'File must be 4MB or smaller.')
  .mime([...FILE_UPLOAD_MIME_TYPES], GENERIC_TYPE_ERROR);

// FormData is all strings, so isGlobal is coerced before the union parse.
function parseTarget(
  formData: FormData,
): z.ZodSafeParseResult<QuestionFileTarget> {
  const raw = {
    scope: formData.get('scope'),
    questionId: formData.get('questionId'),
    applicationId: formData.get('applicationId'),
    isGlobal: formData.get('isGlobal') === 'true',
  };
  return questionFileTargetSchema.safeParse(raw);
}

type ResolvedTarget =
  | { scope: 'profile' }
  | { scope: 'application'; positionId: string };

// An ownership miss is IDOR-style and throws; a stale tab's submit returns.
async function authorizeTarget(
  userId: string,
  target: QuestionFileTarget,
): Promise<ResolvedTarget | { error: string }> {
  if (target.scope === 'profile') {
    const question = await prisma.globalQuestion.findFirst({
      where: { id: target.questionId, deletedAt: null, type: 'file_upload' },
      select: { id: true },
    });
    if (!question) throw new Error('Question not found or not authorized');
    return { scope: 'profile' };
  }

  const application = await prisma.application.findFirst({
    where: { id: target.applicationId, userId, deletedAt: null },
    select: { positionId: true, status: true },
  });
  if (!application) throw new Error('Application not found or not authorized');

  if (target.isGlobal) {
    const question = await prisma.globalQuestion.findFirst({
      where: { id: target.questionId, deletedAt: null, type: 'file_upload' },
      select: { id: true },
    });
    if (!question) throw new Error('Question not found or not authorized');
  } else {
    const question = await prisma.positionQuestion.findFirst({
      where: {
        id: target.questionId,
        deletedAt: null,
        type: 'file_upload',
        positionId: application.positionId,
      },
      select: { id: true },
    });
    if (!question) throw new Error('Question not found or not authorized');
  }

  if (application.status !== 'draft') return { error: SUBMITTED_ERROR };

  return { scope: 'application', positionId: application.positionId };
}

function revalidateTarget(resolved: ResolvedTarget) {
  if (resolved.scope === 'profile') revalidatePath('/profile');
  else revalidatePath(`/positions/${resolved.positionId}/apply`);
}

// One transaction, so neither a concurrent write nor a concurrent submit can slip in.
async function readAndWriteAnswerValue(
  tx: Prisma.TransactionClient,
  target: QuestionFileTarget,
  value: string[],
  userId: string,
): Promise<string | null> {
  if (target.scope === 'profile') {
    const where = {
      userId_globalQuestionId: { userId, globalQuestionId: target.questionId },
    };
    const existing = await tx.globalAnswer.findUnique({
      where,
      select: { value: true },
    });
    await tx.globalAnswer.upsert({
      where,
      update: { value, updatedById: userId },
      create: {
        userId,
        globalQuestionId: target.questionId,
        value,
        createdById: userId,
        updatedById: userId,
      },
    });
    return existing?.value[0] ?? null;
  }

  const application = await tx.application.findFirst({
    where: { id: target.applicationId, status: 'draft' },
    select: { id: true },
  });
  if (!application) throw new ApplicationSubmittedError();

  if (target.isGlobal) {
    const where = {
      applicationId_globalQuestionId: {
        applicationId: target.applicationId,
        globalQuestionId: target.questionId,
      },
    };
    const existing = await tx.globalApplicationAnswer.findUnique({
      where,
      select: { value: true },
    });
    const question = await tx.globalQuestion.findUniqueOrThrow({
      where: { id: target.questionId },
      select: { label: true, type: true },
    });
    await tx.globalApplicationAnswer.upsert({
      where,
      update: { value, updatedById: userId },
      create: {
        applicationId: target.applicationId,
        globalQuestionId: target.questionId,
        questionLabel: question.label,
        questionType: question.type,
        value,
        createdById: userId,
        updatedById: userId,
      },
    });
    return existing?.value[0] ?? null;
  }

  const where = {
    applicationId_positionQuestionId: {
      applicationId: target.applicationId,
      positionQuestionId: target.questionId,
    },
  };
  const existing = await tx.positionApplicationAnswer.findUnique({
    where,
    select: { value: true },
  });
  const question = await tx.positionQuestion.findUniqueOrThrow({
    where: { id: target.questionId },
    select: { label: true, type: true },
  });
  await tx.positionApplicationAnswer.upsert({
    where,
    update: { value, updatedById: userId },
    create: {
      applicationId: target.applicationId,
      positionQuestionId: target.questionId,
      questionLabel: question.label,
      questionType: question.type,
      value,
      createdById: userId,
      updatedById: userId,
    },
  });
  return existing?.value[0] ?? null;
}

// Several rows can share one blob, so it goes only with the last reference.
export async function cleanupOrphanedBlob(url: string): Promise<void> {
  try {
    const [profileCount, globalAppCount, positionAppCount] = await Promise.all([
      prisma.globalAnswer.count({ where: { value: { has: url } } }),
      prisma.globalApplicationAnswer.count({ where: { value: { has: url } } }),
      prisma.positionApplicationAnswer.count({
        where: { value: { has: url } },
      }),
    ]);
    if (profileCount + globalAppCount + positionAppCount === 0) await del(url);
  } catch {
    // Swallowed: an orphaned blob is never user-actionable.
  }
}

export async function uploadQuestionFileAnswer(
  formData: FormData,
): Promise<ResponseType<{ url: string; name: string }>> {
  const user = await getCurrentUser();

  const targetParsed = parseTarget(formData);
  if (!targetParsed.success) return { error: 'Invalid input' };
  const target = targetParsed.data;

  const fileParsed = fileSchema.safeParse(formData.get('file'));
  if (!fileParsed.success)
    return { error: fileParsed.error.issues[0]?.message ?? GENERIC_TYPE_ERROR };
  const file = fileParsed.data;

  // file.type is spoofable; the sniffed type is what gets stored.
  const sniffed = sniffMimeType(
    new Uint8Array(await file.slice(0, 8).arrayBuffer()),
  );
  if (!sniffed) return { error: GENERIC_TYPE_ERROR };

  const resolved = await authorizeTarget(user.id, target);
  if ('error' in resolved) return resolved;

  const ext = FILE_UPLOAD_MIME_EXTENSIONS[sniffed];
  const pathname = buildAnswerFilePathname(target, user.id, file.name, ext);

  // A put() failure isn't user-actionable — throw for the generic toast.
  const blob = await put(pathname, file, {
    access: 'private',
    addRandomSuffix: true,
    contentType: sniffed,
  });

  let oldUrl: string | null;
  try {
    oldUrl = await prisma.$transaction((tx) =>
      readAndWriteAnswerValue(tx, target, [blob.url], user.id),
    );
  } catch (error) {
    // A failed write must not orphan the blob just uploaded.
    await del(blob.url).catch(() => {});
    if (error instanceof ApplicationSubmittedError)
      return { error: SUBMITTED_ERROR };
    throw error;
  }

  if (oldUrl && oldUrl !== blob.url) await cleanupOrphanedBlob(oldUrl);

  revalidateTarget(resolved);

  return { url: blob.url, name: getFileDisplayName(blob.url) };
}

export async function removeQuestionFileAnswer(
  input: unknown,
): Promise<ResponseType<void>> {
  const user = await getCurrentUser();

  const parsed = questionFileTargetSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };
  const target = parsed.data;

  const resolved = await authorizeTarget(user.id, target);
  if ('error' in resolved) return resolved;

  let oldUrl: string | null;
  try {
    oldUrl = await prisma.$transaction((tx) =>
      readAndWriteAnswerValue(tx, target, [], user.id),
    );
  } catch (error) {
    if (error instanceof ApplicationSubmittedError)
      return { error: SUBMITTED_ERROR };
    throw error;
  }

  if (oldUrl) await cleanupOrphanedBlob(oldUrl);

  revalidateTarget(resolved);
}

export async function downloadQuestionFileAnswer(
  input: unknown,
): Promise<ResponseType<QuestionFileDownload>> {
  const user = await getCurrentUser();

  const parsed = questionFileTargetSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };
  const target = parsed.data;

  let url: string | null = null;

  // Authorization is by row + caller, never by URL.
  if (target.scope === 'profile') {
    const answer = await prisma.globalAnswer.findUnique({
      where: {
        userId_globalQuestionId: {
          userId: user.id,
          globalQuestionId: target.questionId,
        },
      },
      select: { value: true },
    });
    if (!answer) throw new Error('Answer not found or not authorized');
    url = answer.value[0] ?? null;
  } else {
    // Owned by the caller or in their reviewer scope, as in getApplicationForReview.
    const where = user.isAdmin
      ? { id: target.applicationId, deletedAt: null }
      : {
          id: target.applicationId,
          deletedAt: null,
          OR: [
            { userId: user.id },
            { position: { managers: { some: { id: user.id } } } },
          ],
        };
    const application = await prisma.application.findFirst({
      where,
      select: { id: true },
    });
    if (!application)
      throw new Error('Application not found or not authorized');

    if (target.isGlobal) {
      const answer = await prisma.globalApplicationAnswer.findUnique({
        where: {
          applicationId_globalQuestionId: {
            applicationId: target.applicationId,
            globalQuestionId: target.questionId,
          },
        },
        select: { value: true },
      });
      url = answer?.value[0] ?? null;
    } else {
      const answer = await prisma.positionApplicationAnswer.findUnique({
        where: {
          applicationId_positionQuestionId: {
            applicationId: target.applicationId,
            positionQuestionId: target.questionId,
          },
        },
        select: { value: true },
      });
      url = answer?.value[0] ?? null;
    }
  }

  if (!url) return { error: NOT_AVAILABLE_ERROR };

  const result = await get(url, { access: 'private' });
  if (!result || result.stream === null) return { error: NOT_AVAILABLE_ERROR };

  const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());

  return {
    filename: getFileDisplayName(url),
    contentType: result.blob.contentType,
    data: buffer.toString('base64'),
  };
}
