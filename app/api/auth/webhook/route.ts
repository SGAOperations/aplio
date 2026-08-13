import { z } from 'zod';

import { sendEmail } from '@/lib/email/resend';
import { magicLinkEmail, otpEmail } from '@/lib/email/templates';
import { verifyWebhookSignature } from '@/lib/email/verify-webhook';

// Neon Auth webhook route — intercepts send.otp and send.magic_link events and
// delivers branded transactional emails through Resend instead of Neon's default
// sender (noreply@stackframe.co).
//
// This is the one permitted API route exception to the no-API-routes rule: it is
// auth infrastructure that must be a publicly reachable HTTP endpoint. It is NOT
// a Server Action, so the §4 { error }/throw action model does not apply — the
// contract here is plain HTTP status codes: 200 handled, 400 bad request, 500
// unexpected failure (so Neon can retry).
//
// Static segment "webhook" takes precedence over the [...path] catch-all beside it,
// so existing auth routes (login, callback, etc.) are unaffected.

// Neon uses event_type (not type) as the discriminator and nests event-specific
// fields under event_data. The recipient's location varies with account state: an
// existing user's event carries user.email, but a first-time sign-up has no user
// row at send time — better-auth creates it at verification, not when the OTP is
// issued — so the address can arrive top-level or under event_data instead.
// Accept all three; assuming user.email silently dropped every sign-up (#435).
const userSchema = z
  .object({ email: z.string().email().optional() })
  .optional();

const otpEventSchema = z.object({
  event_type: z.literal('send.otp'),
  user: userSchema,
  email: z.string().email().optional(),
  event_data: z.object({
    otp_code: z.string(),
    expires_at: z.string().optional(),
    email: z.string().email().optional(),
  }),
});

const magicLinkEventSchema = z.object({
  event_type: z.literal('send.magic_link'),
  user: userSchema,
  email: z.string().email().optional(),
  event_data: z.object({
    link_url: z.string().url(),
    expires_at: z.string().optional(),
    email: z.string().email().optional(),
  }),
});

const webhookEventSchema = z.discriminatedUnion('event_type', [
  otpEventSchema,
  magicLinkEventSchema,
]);

const badRequest = () => new Response(null, { status: 400 });

// Replaces every leaf value with its type, so a rejected payload can be logged
// structurally. The body carries a live OTP code and magic-link token, so the
// values themselves must never reach the logs — only the shape is diagnostic.
function describeShape(value: unknown): unknown {
  if (Array.isArray(value))
    return value.length ? [describeShape(value[0])] : [];
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        describeShape(nested),
      ]),
    );
  return typeof value;
}

// event_type is a non-sensitive discriminator and the single most useful field
// when a payload is rejected, so it is read directly rather than type-masked.
function readEventType(value: unknown): string {
  if (value && typeof value === 'object' && 'event_type' in value)
    return String((value as { event_type: unknown }).event_type);
  return '<missing>';
}

function minutesUntil(isoString: string | undefined): number | undefined {
  if (!isoString) return undefined;
  const mins = Math.round(
    (new Date(isoString).getTime() - Date.now()) / 60_000,
  );
  return mins > 0 ? mins : undefined;
}

export async function POST(req: Request): Promise<Response> {
  // Read the raw body once — needed both for signature verification and JSON parsing.
  const rawBody = await req.text();

  // Verify the Neon Auth signature before doing anything else.
  const signatureHeader = req.headers.get('X-Neon-Signature');
  const kidHeader = req.headers.get('X-Neon-Signature-Kid');
  const timestampHeader = req.headers.get('X-Neon-Timestamp');

  const { valid } = await verifyWebhookSignature(
    rawBody,
    signatureHeader,
    kidHeader,
    timestampHeader,
  );
  if (!valid) return badRequest();

  // Parse and validate the payload.
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return badRequest();
  }

  // A rejected payload means no email is sent at all — subscribing a webhook makes
  // Neon skip its own delivery — so both failure paths log their shape rather than
  // returning a bare 400. Silence here hid #435 for seven weeks.
  const result = webhookEventSchema.safeParse(parsed);
  if (!result.success) {
    console.error(
      '[webhook] Unrecognized payload for %s; shape: %s',
      readEventType(parsed),
      JSON.stringify(describeShape(parsed)),
    );
    return badRequest();
  }

  const event = result.data;
  const email = event.user?.email ?? event.email ?? event.event_data.email;
  if (!email) {
    console.error(
      '[webhook] No recipient resolved for %s; shape: %s',
      event.event_type,
      JSON.stringify(describeShape(parsed)),
    );
    return badRequest();
  }

  // Dispatch by event type and send the branded email.
  try {
    switch (event.event_type) {
      case 'send.otp': {
        const template = otpEmail({
          code: event.event_data.otp_code,
          expiresInMinutes: minutesUntil(event.event_data.expires_at),
        });
        await sendEmail({ to: email, ...template });
        break;
      }
      case 'send.magic_link': {
        const template = magicLinkEmail({
          url: event.event_data.link_url,
          expiresInMinutes: minutesUntil(event.event_data.expires_at),
        });
        await sendEmail({ to: email, ...template });
        break;
      }
      default: {
        // TypeScript exhaustiveness guard — unreachable if zod schema is complete.
        const _exhaustive: never = event;
        void _exhaustive;
        return badRequest();
      }
    }
  } catch (err) {
    // Log server-side without leaking internals; return 500 so Neon retries.
    // Note: a transient Resend failure + retry may cause a duplicate send for the
    // same OTP/magic-link — acceptable for auth emails (they carry short-lived codes).
    console.error('[webhook] Failed to send email:', err);
    return new Response(null, { status: 500 });
  }

  return new Response(null, { status: 200 });
}
