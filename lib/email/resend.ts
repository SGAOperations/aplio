import 'server-only';

import { z } from 'zod/v4';

import {
  EmailStatus,
  type EmailTemplateKey,
  type Prisma,
} from '@/prisma/client';

import { RESEND_BATCH_MAX_EMAILS } from '@/lib/constants';
import { getResend } from '@/lib/email/client';
import { prisma } from '@/lib/prisma';

function getSenderAddress(): string {
  if (!process.env.RESEND_FROM_EMAIL)
    throw new Error('RESEND_FROM_EMAIL is not configured');
  return `Aplio <${process.env.RESEND_FROM_EMAIL}>`;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: EmailTemplateKey;
  userId?: string;
  applicationId?: string;
  /** When set, the send is scheduled with Resend and the row is logged `scheduled`, not `sent`. */
  scheduledAt?: Date;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  template,
  userId,
  applicationId,
  scheduledAt,
}: SendEmailParams): Promise<void> {
  const resend = getResend();
  const from = getSenderAddress();

  const resolvedUserId =
    userId ??
    (
      await prisma.user.findUnique({
        where: { email: to },
        select: { id: true },
      })
    )?.id;

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
    result = await resend.emails.send({
      from,
      to,
      subject,
      html,
      text,
      ...(scheduledAt ? { scheduledAt: scheduledAt.toISOString() } : {}),
    });
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
      status: scheduledAt ? EmailStatus.scheduled : EmailStatus.sent,
      providerMessageId: data.id,
      scheduledAt,
      sentAt: scheduledAt ? null : new Date(),
    },
  });
}

export interface SendEmailBatchEntry {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: EmailTemplateKey;
  userId?: string;
  applicationId?: string;
}

function failedRow(
  entry: SendEmailBatchEntry,
  message: string,
): Prisma.EmailLogCreateManyInput {
  return {
    to: entry.to,
    userId: entry.userId,
    applicationId: entry.applicationId,
    template: entry.template,
    subject: entry.subject,
    status: EmailStatus.failed,
    error: message,
  };
}

function sentRow(
  entry: SendEmailBatchEntry,
  providerMessageId: string | null,
): Prisma.EmailLogCreateManyInput {
  return {
    to: entry.to,
    userId: entry.userId,
    applicationId: entry.applicationId,
    template: entry.template,
    subject: entry.subject,
    status: EmailStatus.sent,
    providerMessageId,
    sentAt: new Date(),
  };
}

// One resend.batch.send call for the chunk; writes every row itself so a
// caught failure here still logs the whole chunk `failed`.
async function sendBatchChunk(
  from: string,
  chunk: SendEmailBatchEntry[],
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

  const rows = chunk.map((entry, index) => {
    const failure = errors.find((e) => e.index === index);
    if (failure) return failedRow(entry, failure.message);

    const position = canMapIds ? succeededIndexes.indexOf(index) : -1;
    return sentRow(entry, position >= 0 ? (sent[position]?.id ?? null) : null);
  });

  await prisma.emailLog.createMany({ data: rows });
}

// Second provider choke point, alongside sendEmail — throws the same way;
// the swallow lives at the dispatch boundary (lib/email/application-emails.ts).
export async function sendEmailBatch(
  entries: SendEmailBatchEntry[],
): Promise<void> {
  if (entries.length === 0) return;

  const from = getSenderAddress();
  const emailSchema = z.string().trim().email();
  const valid: SendEmailBatchEntry[] = [];
  const invalid: SendEmailBatchEntry[] = [];
  for (const entry of entries)
    (emailSchema.safeParse(entry.to).success ? valid : invalid).push(entry);

  if (invalid.length > 0)
    await prisma.emailLog.createMany({
      data: invalid.map((entry) =>
        failedRow(entry, 'Invalid recipient address'),
      ),
    });

  let hadFailure = false;
  for (let i = 0; i < valid.length; i += RESEND_BATCH_MAX_EMAILS) {
    const chunk = valid.slice(i, i + RESEND_BATCH_MAX_EMAILS);
    try {
      await sendBatchChunk(from, chunk);
    } catch (err) {
      hadFailure = true;
      const message = err instanceof Error ? err.message : String(err);
      await prisma.emailLog.createMany({
        data: chunk.map((entry) => failedRow(entry, message)),
      });
    }
  }

  if (hadFailure) throw new Error('One or more batch chunks failed to send');
}
