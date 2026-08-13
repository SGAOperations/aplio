import { z } from 'zod';

import { sendEmail } from '@/lib/email/resend';
import { magicLinkEmail, otpEmail } from '@/lib/email/templates';
import { verifyWebhookSignature } from '@/lib/email/verify-webhook';

// A permitted exception to the no-API-routes rule: auth infrastructure that must be a
// publicly reachable endpoint. Its contract is HTTP status codes, not the action model.

// Neon uses event_type (not type) as the discriminator, and nests the recipient
// under user.email and event-specific fields under event_data.
const userSchema = z.object({ email: z.string().email().optional() });

const otpEventSchema = z.object({
  event_type: z.literal('send.otp'),
  user: userSchema,
  event_data: z.object({
    otp_code: z.string(),
    expires_at: z.string().optional(),
  }),
});

const magicLinkEventSchema = z.object({
  event_type: z.literal('send.magic_link'),
  user: userSchema,
  event_data: z.object({
    link_url: z.string().url(),
    expires_at: z.string().optional(),
  }),
});

const webhookEventSchema = z.discriminatedUnion('event_type', [
  otpEventSchema,
  magicLinkEventSchema,
]);

const badRequest = () => new Response(null, { status: 400 });

function minutesUntil(isoString: string | undefined): number | undefined {
  if (!isoString) return undefined;
  const mins = Math.round(
    (new Date(isoString).getTime() - Date.now()) / 60_000,
  );
  return mins > 0 ? mins : undefined;
}

export async function POST(req: Request): Promise<Response> {
  // Read once: both signature verification and JSON parsing need it.
  const rawBody = await req.text();

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

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return badRequest();
  }

  const result = webhookEventSchema.safeParse(parsed);
  if (!result.success) return badRequest();

  const event = result.data;
  const email = event.user.email;
  if (!email) return badRequest();

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
    // 500 so Neon retries. A retry can duplicate a send, which is acceptable for
    // short-lived auth codes.
    console.error('[webhook] Failed to send email:', err);
    return new Response(null, { status: 500 });
  }

  return new Response(null, { status: 200 });
}
