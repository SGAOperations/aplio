// No next/* imports — the unit test project has no Next stubs (vitest.config.ts).
import { signInEmailSchema } from '@/lib/constants';

export const OTP_LINK_EMAIL_PARAM = 'email';
export const OTP_LINK_OTP_PARAM = 'otp';

const OTP_PATTERN = /^\d{6}$/;

export interface OtpLinkParams {
  email: string;
  otp: string;
}

export function buildOtpSignInUrl(
  baseUrl: string,
  email: string,
  otp: string,
): string {
  const params = new URLSearchParams({
    [OTP_LINK_EMAIL_PARAM]: email,
    [OTP_LINK_OTP_PARAM]: otp,
  });
  return `${baseUrl}/login?${params.toString()}`;
}

// Rejects junk params rather than letting them drive the client's auto-verify flow.
export function parseOtpLinkParams(params: {
  email?: string;
  otp?: string;
}): OtpLinkParams | null {
  const emailResult = signInEmailSchema.safeParse({ email: params.email });
  if (!emailResult.success) return null;
  if (!params.otp || !OTP_PATTERN.test(params.otp)) return null;

  return { email: emailResult.data.email, otp: params.otp };
}

// Only the two link params are removed — a future redirectTo (or the hash) survives.
export function strippedOtpLinkHref(href: string): string {
  const url = new URL(href);
  url.searchParams.delete(OTP_LINK_EMAIL_PARAM);
  url.searchParams.delete(OTP_LINK_OTP_PARAM);
  return url.toString();
}
