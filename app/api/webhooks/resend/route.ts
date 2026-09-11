import {
  applyDeliveryEvent,
  deliveryEventSchema,
  getResendWebhookSecret,
  isHandledDeliveryEventType,
  verifyResendWebhook,
} from '@/lib/email/delivery-events';

export async function POST(request: Request): Promise<Response> {
  // Throws (not logs) so Resend retries once the secret is fixed — the
  // thrown message names the variable in the Vercel log without source access.
  const secret = getResendWebhookSecret();

  // The signature covers the exact bytes — never request.json() on this route.
  const rawBody = await request.text();

  const result = verifyResendWebhook({
    rawBody,
    headers: request.headers,
    secret,
  });
  if (!result.verified)
    return Response.json({ error: result.reason }, { status: 400 });

  const type = (result.payload as { type?: unknown }).type;
  if (typeof type !== 'string' || !isHandledDeliveryEventType(type))
    return Response.json({ ignored: 'unhandled event type', type });

  const parsed = deliveryEventSchema.safeParse(result.payload);
  if (!parsed.success)
    return Response.json({ error: 'Invalid payload' }, { status: 400 });

  const applied = await applyDeliveryEvent(parsed.data);
  if (applied === null)
    return Response.json({
      ignored: 'no matching row or already terminal',
      type,
    });

  return Response.json({ applied });
}
