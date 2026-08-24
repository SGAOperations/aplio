import 'server-only';

import { Resend } from 'resend';

import { EmailStatus, type EmailTemplateKey } from '@/prisma/client';

import { prisma } from '@/lib/prisma';

// Lazy, so a missing env var doesn't break builds or non-email paths.
let _resend: Resend | null = null;

function getResend(): Resend {
  if (!process.env.RESEND_API_KEY)
    throw new Error('RESEND_API_KEY is not configured');
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

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
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  template,
  userId,
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
      template,
      subject,
      status: EmailStatus.sent,
      providerMessageId: data.id,
      sentAt: new Date(),
    },
  });
}
