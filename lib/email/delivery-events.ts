import 'server-only';

import { z } from 'zod/v4';

import { EmailStatus } from '@/prisma/client';

import { getResend } from '@/lib/email/client';
import { prisma } from '@/lib/prisma';

// Rank is what makes replays and out-of-order events no-ops: an incoming
// event is applied only where it strictly outranks the row's current status.
export const EMAIL_STATUS_RANK: Record<EmailStatus, number> = {
  scheduled: 0,
  sent: 1,
  delivered: 2,
  cancelled: 3,
  failed: 4,
  suppressed: 5,
  bounced: 6,
  complained: 7,
};

export function statusesBelow(status: EmailStatus): EmailStatus[] {
  const rank = EMAIL_STATUS_RANK[status];
  return (Object.keys(EMAIL_STATUS_RANK) as EmailStatus[]).filter(
    (candidate) => EMAIL_STATUS_RANK[candidate] < rank,
  );
}

export const HANDLED_DELIVERY_EVENT_TYPES = [
  'email.delivered',
  'email.bounced',
  'email.complained',
  'email.suppressed',
] as const;

export type HandledDeliveryEventType =
  (typeof HANDLED_DELIVERY_EVENT_TYPES)[number];

export function isHandledDeliveryEventType(
  type: string,
): type is HandledDeliveryEventType {
  return (HANDLED_DELIVERY_EVENT_TYPES as readonly string[]).includes(type);
}

const baseDataSchema = z.object({ email_id: z.string() });

export const deliveryEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('email.delivered'),
    created_at: z.string(),
    data: baseDataSchema,
  }),
  z.object({
    type: z.literal('email.bounced'),
    created_at: z.string(),
    data: baseDataSchema.extend({
      bounce: z.object({ type: z.string(), message: z.string() }),
    }),
  }),
  z.object({
    type: z.literal('email.complained'),
    created_at: z.string(),
    data: baseDataSchema,
  }),
  z.object({
    type: z.literal('email.suppressed'),
    created_at: z.string(),
    data: baseDataSchema.extend({
      suppressed: z.object({ message: z.string() }),
    }),
  }),
]);

export type DeliveryEvent = z.infer<typeof deliveryEventSchema>;

export interface DeliveryUpdateFields {
  deliveredAt?: Date;
  bounceType?: string;
  error?: string;
}

export interface DeliveryUpdate {
  emailId: string;
  status: EmailStatus;
  fields: DeliveryUpdateFields;
}

export function toDeliveryUpdate(event: DeliveryEvent): DeliveryUpdate {
  switch (event.type) {
    case 'email.delivered':
      return {
        emailId: event.data.email_id,
        status: EmailStatus.delivered,
        fields: { deliveredAt: new Date(event.created_at) },
      };
    case 'email.bounced':
      return {
        emailId: event.data.email_id,
        status: EmailStatus.bounced,
        fields: {
          bounceType: event.data.bounce.type,
          error: event.data.bounce.message,
        },
      };
    case 'email.complained':
      return {
        emailId: event.data.email_id,
        status: EmailStatus.complained,
        fields: {},
      };
    case 'email.suppressed':
      return {
        emailId: event.data.email_id,
        status: EmailStatus.suppressed,
        fields: { error: event.data.suppressed.message },
      };
    default: {
      const exhaustive: never = event;
      throw new Error(
        `Unhandled delivery event: ${JSON.stringify(exhaustive)}`,
      );
    }
  }
}

// Rank guard makes this a single atomic no-op-or-apply write — no read then write.
export async function applyDeliveryEvent(
  event: DeliveryEvent,
): Promise<EmailStatus | null> {
  const { emailId, status, fields } = toDeliveryUpdate(event);

  const result = await prisma.emailLog.updateMany({
    where: {
      providerMessageId: emailId,
      status: { in: statusesBelow(status) },
    },
    data: { status, ...fields },
  });

  return result.count > 0 ? status : null;
}

interface ResendWebhookHeaders {
  id: string;
  timestamp: string;
  signature: string;
}

// Resend sends the standard-webhooks svix-* names; fall back to webhook-*
// in case that ever changes, since the SDK maps these onto webhook-* itself.
function extractWebhookHeaders(headers: Headers): ResendWebhookHeaders | null {
  const id = headers.get('svix-id') ?? headers.get('webhook-id');
  const timestamp =
    headers.get('svix-timestamp') ?? headers.get('webhook-timestamp');
  const signature =
    headers.get('svix-signature') ?? headers.get('webhook-signature');
  if (!id || !timestamp || !signature) return null;
  return { id, timestamp, signature };
}

export function verifyResendWebhook(params: {
  rawBody: string;
  headers: Headers;
  secret: string;
}): unknown {
  const webhookHeaders = extractWebhookHeaders(params.headers);
  if (!webhookHeaders) return null;

  try {
    return getResend().webhooks.verify({
      payload: params.rawBody,
      headers: webhookHeaders,
      webhookSecret: params.secret,
    });
  } catch {
    return null;
  }
}
