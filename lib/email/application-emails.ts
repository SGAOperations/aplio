import 'server-only';

import type { $Enums } from '@/prisma/client';

import {
  DECISION_EMAIL_DELAY_MINUTES,
  DECISION_EMAIL_TEMPLATES,
} from '@/lib/constants';
import { getResend } from '@/lib/email/client';
import { sendEmail, sendEmailBatch } from '@/lib/email/resend';
import {
  applicationAcceptedEmail,
  applicationReceivedEmail,
  applicationRejectedEmail,
} from '@/lib/email/templates';
import { prisma } from '@/lib/prisma';
import { getFirstName } from '@/lib/utils';

type DecisionStatus = 'accepted' | 'rejected';

function isDecisionStatus(
  status: $Enums.ApplicationStatus,
): status is DecisionStatus {
  return status === 'accepted' || status === 'rejected';
}

export interface DecisionEmailRecipient {
  applicationId: string;
  userId: string;
  to: string;
  name?: string;
  positionTitle: string;
}

function decisionEmailTemplate(
  status: DecisionStatus,
  recipient: DecisionEmailRecipient,
) {
  const firstName = getFirstName(recipient.name);
  return status === 'accepted'
    ? applicationAcceptedEmail({
        firstName,
        positionTitle: recipient.positionTitle,
        applicationId: recipient.applicationId,
      })
    : applicationRejectedEmail({
        firstName,
        positionTitle: recipient.positionTitle,
      });
}

export async function sendApplicationReceipt(recipient: {
  applicationId: string;
  userId: string;
  to: string;
  name?: string;
  positionTitle: string;
}): Promise<void> {
  try {
    const { subject, html, text } = applicationReceivedEmail({
      firstName: getFirstName(recipient.name),
      positionTitle: recipient.positionTitle,
      applicationId: recipient.applicationId,
    });
    await sendEmail({
      to: recipient.to,
      subject,
      html,
      text,
      template: 'application_received',
      userId: recipient.userId,
      applicationId: recipient.applicationId,
    });
  } catch {
    // Already recorded as an EmailLog row by sendEmail — the actor must never see this.
  }
}

// No scheduledAt time filter — attempt the cancel regardless and let the provider be the judge.
export async function cancelPendingDecisionEmails(
  applicationIds: string[],
): Promise<void> {
  if (applicationIds.length === 0) return;

  const pending = await prisma.emailLog.findMany({
    where: {
      applicationId: { in: applicationIds },
      status: 'scheduled',
      providerMessageId: { not: null },
    },
    select: { id: true, providerMessageId: true },
  });

  if (pending.length === 0) return;

  const resend = getResend();
  for (const row of pending) {
    try {
      const { error } = await resend.emails.cancel(row.providerMessageId!);
      if (error) throw new Error(error.message);
      await prisma.emailLog.update({
        where: { id: row.id },
        data: { status: 'cancelled' },
      });
    } catch (err) {
      // Best-effort: the mail almost certainly already went out. Leave the row
      // `scheduled` so a later delivered webhook can still upgrade it.
      await prisma.emailLog.update({
        where: { id: row.id },
        data: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  }
}

// Covers the quick actions, the override Select, and undo alike — cancel
// first so a re-applied decision after a cancel is always a fresh schedule.
export async function dispatchDecisionEmail({
  recipient,
  status,
}: {
  recipient: DecisionEmailRecipient;
  status: $Enums.ApplicationStatus;
}): Promise<void> {
  try {
    await cancelPendingDecisionEmails([recipient.applicationId]);

    if (!isDecisionStatus(status)) return;

    const { subject, html, text } = decisionEmailTemplate(status, recipient);
    const scheduledAt = new Date(
      Date.now() + DECISION_EMAIL_DELAY_MINUTES * 60_000,
    );

    await sendEmail({
      to: recipient.to,
      subject,
      html,
      text,
      template: DECISION_EMAIL_TEMPLATES[status],
      userId: recipient.userId,
      applicationId: recipient.applicationId,
      scheduledAt,
    });
  } catch {
    // Already recorded as an EmailLog row — the status change must never be undone by a mail failure.
  }
}

// Eligibility isn't forward-only, so a bulk move can land on a row that
// still holds a pending single-decision send — cancel first, same as dispatchDecisionEmail.
export async function dispatchBulkDecisionEmails({
  recipients,
  status,
}: {
  recipients: DecisionEmailRecipient[];
  status: $Enums.ApplicationStatus;
}): Promise<void> {
  if (recipients.length === 0 || !isDecisionStatus(status)) return;

  try {
    await cancelPendingDecisionEmails(recipients.map((r) => r.applicationId));

    const entries = recipients.map((recipient) => {
      const { subject, html, text } = decisionEmailTemplate(status, recipient);
      return {
        to: recipient.to,
        subject,
        html,
        text,
        template: DECISION_EMAIL_TEMPLATES[status],
        userId: recipient.userId,
        applicationId: recipient.applicationId,
      };
    });

    await sendEmailBatch(entries);
  } catch {
    // Already recorded as EmailLog rows — a batch failure must never undo the status change.
  }
}
