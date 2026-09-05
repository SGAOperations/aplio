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
import { classifyDecisionEmailStatus, getFirstName } from '@/lib/utils';

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

// Returns the applicationIds whose pending send couldn't be verified
// cancelled, so a caller never schedules a competing send on top of one
// still live in Resend.
export async function cancelPendingDecisionEmails(
  applicationIds: string[],
): Promise<Set<string>> {
  if (applicationIds.length === 0) return new Set();

  const pending = await prisma.emailLog.findMany({
    where: {
      applicationId: { in: applicationIds },
      status: 'scheduled',
      providerMessageId: { not: null },
    },
    select: { id: true, applicationId: true, providerMessageId: true },
  });

  if (pending.length === 0) return new Set();

  const resend = getResend();
  const uncancelled = new Set<string>();
  for (const row of pending) {
    if (!row.providerMessageId) continue;
    try {
      const { error } = await resend.emails.cancel(row.providerMessageId);
      if (error) throw new Error(error.message);
      await prisma.emailLog.update({
        where: { id: row.id },
        data: { status: 'cancelled' },
      });
    } catch (err) {
      if (row.applicationId) uncancelled.add(row.applicationId);
      // Best-effort: the mail almost certainly already went out. Leave the row
      // `scheduled` so a later delivered webhook can still upgrade it, and so
      // the next status change on this application retries the cancel.
      await prisma.emailLog.update({
        where: { id: row.id },
        data: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  }
  return uncancelled;
}

// Applications with a decision email that has already left Resend's control —
// the permanent one-email-ever gate reads this before every dispatch.
async function applicationsWithDispatchedDecisionEmail(
  applicationIds: string[],
): Promise<Set<string>> {
  if (applicationIds.length === 0) return new Set();

  const logs = await prisma.emailLog.findMany({
    where: {
      applicationId: { in: applicationIds },
      template: { in: Object.values(DECISION_EMAIL_TEMPLATES) },
    },
    select: { applicationId: true, status: true },
  });

  const dispatched = new Set<string>();
  for (const log of logs)
    if (log.applicationId && classifyDecisionEmailStatus(log.status) === 'sent')
      dispatched.add(log.applicationId);
  return dispatched;
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
    const uncancelled = await cancelPendingDecisionEmails([
      recipient.applicationId,
    ]);

    if (!isDecisionStatus(status)) return;

    // A prior schedule that couldn't be verified cancelled may still fire in
    // Resend — scheduling another here would double-send the applicant.
    if (uncancelled.has(recipient.applicationId)) return;

    const dispatched = await applicationsWithDispatchedDecisionEmail([
      recipient.applicationId,
    ]);
    if (dispatched.has(recipient.applicationId)) return;

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

// Eligibility isn't forward-only, so a bulk move can land on a row that still
// holds a pending single-decision send — cancel first, same as
// dispatchDecisionEmail, and skip anything that can't be verified cancelled.
export async function dispatchBulkDecisionEmails({
  recipients,
  status,
}: {
  recipients: DecisionEmailRecipient[];
  status: $Enums.ApplicationStatus;
}): Promise<void> {
  if (recipients.length === 0 || !isDecisionStatus(status)) return;

  try {
    const applicationIds = recipients.map((r) => r.applicationId);
    const uncancelled = await cancelPendingDecisionEmails(applicationIds);
    const dispatched =
      await applicationsWithDispatchedDecisionEmail(applicationIds);
    const eligible = recipients.filter(
      (r) =>
        !dispatched.has(r.applicationId) && !uncancelled.has(r.applicationId),
    );
    if (eligible.length === 0) return;

    const entries = eligible.map((recipient) => {
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
