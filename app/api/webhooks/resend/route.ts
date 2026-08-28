import {
  applyDeliveryEvent,
  deliveryEventSchema,
  isHandledDeliveryEventType,
  verifyResendWebhook,
} from '@/lib/email/delivery-events';

export async function POST(request: Request): Promise<Response> {
  // Missing config, not an event we could have processed either way.
  if (!process.env.RESEND_WEBHOOK_SECRET)
    throw new Error('RESEND_WEBHOOK_SECRET is not configured');

  // The signature covers the exact bytes — never request.json() on this route.
  const rawBody = await request.text();

  const verified = verifyResendWebhook({
    rawBody,
    headers: request.headers,
    secret: process.env.RESEND_WEBHOOK_SECRET,
  });
  if (verified === null)
    return Response.json({ error: 'Invalid signature' }, { status: 400 });

  const type = (verified as { type?: unknown }).type;
  if (typeof type !== 'string' || !isHandledDeliveryEventType(type))
    return Response.json({ ignored: 'unhandled event type' });

  const parsed = deliveryEventSchema.safeParse(verified);
  if (!parsed.success)
    return Response.json({ error: 'Invalid payload' }, { status: 400 });

  const applied = await applyDeliveryEvent(parsed.data);
  if (applied === null)
    return Response.json({ ignored: 'no matching row or already terminal' });

  return Response.json({ applied });
}
