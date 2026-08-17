// better-auth@1.6.29's APIError.from flattens { code, message } to the top
// level of the error body; parsed defensively in case a future minor nests it.

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
  const nested =
    typeof source.message === 'object' && source.message !== null
      ? (source.message as Record<string, unknown>)
      : undefined;

  return {
    code: readString(source.code) ?? readString(nested?.code),
    status: readNumber(source.status),
    message: readString(source.message) ?? readString(nested?.message),
  };
}

export function getErrorCode(error: unknown): string | undefined {
  return extractAuthError(error).code;
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
