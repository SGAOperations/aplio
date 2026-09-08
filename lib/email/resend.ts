import 'server-only';

import { z } from 'zod/v4';

import { EmailStatus, type EmailTemplateKey } from '@/prisma/client';

import { RESEND_BATCH_MAX_EMAILS } from '@/lib/constants';
import { getResend } from '@/lib/email/client';
import { prisma } from '@/lib/prisma';

function getSenderAddress(): string {
  if (!process.env.RESEND_FROM_EMAIL)
    throw new Error('RESEND_FROM_EMAIL is not configured');
  return `Aplio <${process.env.RESEND_FROM_EMAIL}>`;
}

async function resolveUserId(
  to: string,
  userId?: string,
): Promise<string | undefined> {
  if (userId) return userId;
  return (
    await prisma.user.findUnique({ where: { email: to }, select: { id: true } })
  )?.id;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: EmailTemplateKey;
  userId?: string;
  applicationId?: string;
}

// Always immediate — Resend is never asked to hold a send. Decision emails
// hold their own delay instead (lib/email/application-emails.ts).
export async function sendEmail({
  to,
  subject,
  html,
  text,
  template,
  userId,
  applicationId,
}: SendEmailParams): Promise<void> {
  const resend = getResend();
  const from = getSenderAddress();
  const resolvedUserId = await resolveUserId(to, userId);

  const logFailure = (message: string) =>
    prisma.emailLog.create({
      data: {
        to,
        userId: resolvedUserId,
        applicationId,
        template,
        subject,
        status: EmailStatus.failed,
        error: message,
      },
    });

  let result;
  try {
    result = await resend.emails.send({ from, to, subject, html, text });
  } catch (err) {
    await logFailure(err instanceof Error ? err.message : String(err));
    throw new Error('Resend send failed', { cause: err });
  }

  const { data, error } = result;
  if (error) {
    await logFailure(error.message);
    throw new Error(`Resend send failed: ${error.message}`);
  }

  await prisma.emailLog.create({
    data: {
      to,
      userId: resolvedUserId,
      applicationId,
      template,
      subject,
      status: EmailStatus.sent,
      providerMessageId: data.id,
      sentAt: new Date(),
    },
  });
}

export interface CreateScheduledEmailLogParams {
  to: string;
  userId?: string;
  applicationId?: string;
  template: EmailTemplateKey;
  subject: string;
  /** When the self-managed wait is due to release this row — observability only, Resend is never told. */
  scheduledAt: Date;
}

// Written before the wait starts, not after — undo is then a pure status
// flip (cancelPendingDecisionEmails) with no provider round-trip to race.
export async function createScheduledEmailLog(
  params: CreateScheduledEmailLogParams,
): Promise<string> {
  const resolvedUserId = await resolveUserId(params.to, params.userId);
  const log = await prisma.emailLog.create({
    data: {
      to: params.to,
      userId: resolvedUserId,
      applicationId: params.applicationId,
      template: params.template,
      subject: params.subject,
      status: EmailStatus.scheduled,
      scheduledAt: params.scheduledAt,
    },
  });
  return log.id;
}

export interface SendScheduledEmailLogParams {
  logId: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

// Only called once the caller has re-checked the row is still `scheduled` —
// upgrades it in place to `sent`/`failed` rather than creating a new row.
export async function sendScheduledEmailLog({
  logId,
  to,
  subject,
  html,
  text,
}: SendScheduledEmailLogParams): Promise<void> {
  const resend = getResend();
  const from = getSenderAddress();

  let result;
  try {
    result = await resend.emails.send({ from, to, subject, html, text });
  } catch (err) {
    await prisma.emailLog.update({
      where: { id: logId },
      data: {
        status: EmailStatus.failed,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw new Error('Resend send failed', { cause: err });
  }

  const { data, error } = result;
  if (error) {
    await prisma.emailLog.update({
      where: { id: logId },
      data: { status: EmailStatus.failed, error: error.message },
    });
    throw new Error(`Resend send failed: ${error.message}`);
  }

  await prisma.emailLog.update({
    where: { id: logId },
    data: {
      status: EmailStatus.sent,
      providerMessageId: data.id,
      sentAt: new Date(),
    },
  });
}

export interface SendScheduledBatchEntry {
  logId: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

// One resend.batch.send call for the chunk; updates every row itself so a
// caught failure here still marks the whole chunk `failed`.
async function sendScheduledBatchChunk(
  from: string,
  chunk: SendScheduledBatchEntry[],
): Promise<void> {
  const resend = getResend();
  const payload = chunk.map((entry) => ({
    from,
    to: entry.to,
    subject: entry.subject,
    html: entry.html,
    text: entry.text,
  }));

  const response = await resend.batch.send(payload, {
    batchValidation: 'permissive' as const,
  });

  if (response.error) throw new Error(response.error.message);

  const { data: sent, errors } = response.data;
  const failedIndexes = new Set(errors.map((e) => e.index));
  const succeededIndexes = chunk
    .map((_, index) => index)
    .filter((index) => !failedIndexes.has(index));
  // Only zip when the counts reconcile — a wrong id would attribute a later
  // bounce webhook to the wrong applicant, which is worse than a null one.
  const canMapIds = sent.length === succeededIndexes.length;

  await Promise.all(
    chunk.map(async (entry, index) => {
      const failure = errors.find((e) => e.index === index);
      if (failure) {
        await prisma.emailLog.update({
          where: { id: entry.logId },
          data: { status: EmailStatus.failed, error: failure.message },
        });
        return;
      }
      const position = canMapIds ? succeededIndexes.indexOf(index) : -1;
      await prisma.emailLog.update({
        where: { id: entry.logId },
        data: {
          status: EmailStatus.sent,
          providerMessageId:
            position >= 0 ? (sent[position]?.id ?? null) : null,
          sentAt: new Date(),
        },
      });
    }),
  );
}

// Second provider choke point, alongside sendScheduledEmailLog — throws the
// same way; the swallow lives at the dispatch boundary (lib/email/application-emails.ts).
export async function sendScheduledEmailBatch(
  entries: SendScheduledBatchEntry[],
): Promise<void> {
  if (entries.length === 0) return;

  const from = getSenderAddress();
  const emailSchema = z.string().trim().email();
  const valid: SendScheduledBatchEntry[] = [];
  const invalid: SendScheduledBatchEntry[] = [];
  for (const entry of entries)
    (emailSchema.safeParse(entry.to).success ? valid : invalid).push(entry);

  if (invalid.length > 0)
    await prisma.emailLog.updateMany({
      where: { id: { in: invalid.map((entry) => entry.logId) } },
      data: { status: EmailStatus.failed, error: 'Invalid recipient address' },
    });

  let hadFailure = false;
  for (let i = 0; i < valid.length; i += RESEND_BATCH_MAX_EMAILS) {
    const chunk = valid.slice(i, i + RESEND_BATCH_MAX_EMAILS);
    try {
      await sendScheduledBatchChunk(from, chunk);
    } catch (err) {
      hadFailure = true;
      const message = err instanceof Error ? err.message : String(err);
      await prisma.emailLog.updateMany({
        where: { id: { in: chunk.map((entry) => entry.logId) } },
        data: { status: EmailStatus.failed, error: message },
      });
    }
  }

  if (hadFailure) throw new Error('One or more batch chunks failed to send');
}
