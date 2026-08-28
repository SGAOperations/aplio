import 'server-only';

import { Resend } from 'resend';

// Lazy, so a missing env var doesn't break builds or non-email paths.
let _resend: Resend | null = null;

export function getResend(): Resend {
  if (!process.env.RESEND_API_KEY)
    throw new Error('RESEND_API_KEY is not configured');
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}
