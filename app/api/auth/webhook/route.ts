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

const otpEventSchema = z.object({
  type: z.literal('send.otp'),
  data: z.object({
    email: z.string().email(),
    otp: z.string(),
    expires_at: z.string().optional(),
    expires_in_minutes: z.number().optional(),
  }),
});

const magicLinkEventSchema = z.object({
  type: z.literal('send.magic_link'),
  data: z.object({
    email: z.string().email(),
    magic_link: z.string().url(),
    expires_at: z.string().optional(),
    expires_in_minutes: z.number().optional(),
  }),
});

const webhookEventSchema = z.discriminatedUnion('type', [
  otpEventSchema,
  magicLinkEventSchema,
]);

const badRequest = () => new Response(null, { status: 400 });

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

  const result = webhookEventSchema.safeParse(parsed);
  if (!result.success) return badRequest();

  const event = result.data;

  // Dispatch by event type and send the branded email.
  try {
    switch (event.type) {
      case 'send.otp': {
        const template = otpEmail({
          code: event.data.otp,
          expiresInMinutes: event.data.expires_in_minutes,
        });
        await sendEmail({ to: event.data.email, ...template });
        break;
      }
      case 'send.magic_link': {
        const template = magicLinkEmail({
          url: event.data.magic_link,
          expiresInMinutes: event.data.expires_in_minutes,
        });
        await sendEmail({ to: event.data.email, ...template });
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
