// better-auth/react's client resolves sign-in/OTP calls to { data, error };
// error is the endpoint's parsed JSON body spread with { status, statusText }
// (@better-fetch/fetch's handleFetchResponse). better-auth's own
// APIError.from(status, { code, message }) (better-auth/core's APIError)
// serializes that body as-is (better-call's toResponse), so codes thrown that
// way — email-otp's OTP_EXPIRED / INVALID_OTP / TOO_MANY_ATTEMPTS
// (better-auth/dist/plugins/email-otp/error-codes.mjs) and this app's
// ACCOUNT_DEACTIVATED (lib/auth/config.ts) — round-trip to error.code intact.
// better-auth's built-in rate limiter instead returns a plain Response with
// only a generic message and no code (better-auth/dist/api/rate-limiter),
// so status/message stay the fallback for that case only.

const GENERIC_VERIFY_MESSAGE = "We couldn't check that code. Please try again.";
const GENERIC_SEND_MESSAGE = "Couldn't send the code. Please try again.";

const INVALID_CODE_MESSAGE =
  "That code isn't correct. Check the digits and try again.";
const EXPIRED_CODE_MESSAGE =
  'That code has expired. Send a new code to continue.';
const TOO_MANY_ATTEMPTS_MESSAGE =
  'Too many incorrect attempts. Send a new code to try again.';
const VERIFY_RATE_LIMITED_MESSAGE =
  'Too many attempts. Wait a minute, then send a new code.';
const SEND_RATE_LIMITED_MESSAGE =
  'Too many requests. Wait a minute, then try again.';

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function extractAuthError(error: unknown): {
  code?: string;
  status?: number;
  message?: string;
} {
  if (typeof error !== 'object' || error === null) return {};

  const source = error as Record<string, unknown>;
  return {
    code: readString(source.code),
    status: readNumber(source.status),
    message: readString(source.message),
  };
}

export function getOtpVerifyErrorMessage(error: unknown): string {
  const { code, status, message } = extractAuthError(error);

  switch (code) {
    case 'TOO_MANY_ATTEMPTS':
      return TOO_MANY_ATTEMPTS_MESSAGE;
    case 'OTP_EXPIRED':
      return EXPIRED_CODE_MESSAGE;
    case 'INVALID_OTP':
      return INVALID_CODE_MESSAGE;
  }

  if (status === 429) return VERIFY_RATE_LIMITED_MESSAGE;

  const lowerMessage = message?.toLowerCase();
  if (lowerMessage?.includes('attempts')) return TOO_MANY_ATTEMPTS_MESSAGE;
  if (lowerMessage?.includes('expired')) return EXPIRED_CODE_MESSAGE;
  if (lowerMessage?.includes('invalid') || lowerMessage?.includes('incorrect'))
    return INVALID_CODE_MESSAGE;

  return GENERIC_VERIFY_MESSAGE;
}

export function getOtpSendErrorMessage(error: unknown): string {
  const { status } = extractAuthError(error);
  if (status === 429) return SEND_RATE_LIMITED_MESSAGE;
  return GENERIC_SEND_MESSAGE;
}
