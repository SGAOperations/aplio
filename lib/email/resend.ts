import 'server-only';

import { Resend } from 'resend';

// Lazily constructed singleton — avoids construction at import time when the
// env var is absent (e.g. during build-time type-checking or non-email paths).
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
  return process.env.RESEND_FROM_EMAIL;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// Thin wrapper — throws on Resend errors so the webhook handler can catch and
// return 500 (Neon retries) rather than silently dropping the email.
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: SendEmailParams): Promise<void> {
  const resend = getResend();
  const from = getSenderAddress();

  const { error } = await resend.emails.send({ from, to, subject, html, text });
  if (error) throw new Error(`Resend send failed: ${error.message}`);
}
