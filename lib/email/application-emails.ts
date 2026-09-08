import 'server-only';

import type { $Enums } from '@/prisma/client';

import {
  DECISION_EMAIL_DELAY_SECONDS,
  DECISION_EMAIL_TEMPLATES,
} from '@/lib/constants';
import { delay } from '@/lib/delay';
import {
  createScheduledEmailLog,
  sendEmail,
  sendScheduledEmailBatch,
  sendScheduledEmailLog,
} from '@/lib/email/resend';
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

// Pure DB write — Resend is never told about a still-`scheduled` row until
// the self-managed wait actually elapses, so there is nothing on the
// provider side to cancel. Covers both the single-decision and bulk paths,
// since both create their pending rows the same way.
async function cancelPendingDecisionEmails(
  applicationIds: string[],
): Promise<void> {
  if (applicationIds.length === 0) return;

  await prisma.emailLog.updateMany({
    where: { applicationId: { in: applicationIds }, status: 'scheduled' },
    data: { status: 'cancelled' },
  });
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
// The delay is entirely ours: the row goes `scheduled` up front, this
// function waits the window out in-process, then re-reads the row before
// ever telling Resend about the email — undo during the wait is just the
// cancel above flipping the row, no provider round-trip for either side to lose.
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

    const dispatched = await applicationsWithDispatchedDecisionEmail([
      recipient.applicationId,
    ]);
    if (dispatched.has(recipient.applicationId)) return;

    const { subject, html, text } = decisionEmailTemplate(status, recipient);
    const logId = await createScheduledEmailLog({
      to: recipient.to,
      userId: recipient.userId,
      applicationId: recipient.applicationId,
      template: DECISION_EMAIL_TEMPLATES[status],
      subject,
      scheduledAt: new Date(Date.now() + DECISION_EMAIL_DELAY_SECONDS * 1000),
    });

    await delay(DECISION_EMAIL_DELAY_SECONDS * 1000);

    const current = await prisma.emailLog.findUnique({
      where: { id: logId },
      select: { status: true },
    });
    if (current?.status !== 'scheduled') return; // undone during the wait

    await sendScheduledEmailLog({
      logId,
      to: recipient.to,
      subject,
      html,
      text,
    });
  } catch {
    // Already recorded as an EmailLog row — the status change must never be undone by a mail failure.
  }
}

// Eligibility isn't forward-only, so a bulk move can land on a row that still
// holds a pending single-decision send — cancel first, same as
// dispatchDecisionEmail. Same self-managed wait as the single path, just one
// shared wait for the whole batch and one resend.batch.send at the end of it.
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
    await cancelPendingDecisionEmails(applicationIds);

    const dispatched =
      await applicationsWithDispatchedDecisionEmail(applicationIds);
    const eligible = recipients.filter((r) => !dispatched.has(r.applicationId));
    if (eligible.length === 0) return;

    const scheduledAt = new Date(
      Date.now() + DECISION_EMAIL_DELAY_SECONDS * 1000,
    );
    const prepared = await Promise.all(
      eligible.map(async (recipient) => {
        const { subject, html, text } = decisionEmailTemplate(
          status,
          recipient,
        );
        const logId = await createScheduledEmailLog({
          to: recipient.to,
          userId: recipient.userId,
          applicationId: recipient.applicationId,
          template: DECISION_EMAIL_TEMPLATES[status],
          subject,
          scheduledAt,
        });
        return { logId, to: recipient.to, subject, html, text };
      }),
    );

    await delay(DECISION_EMAIL_DELAY_SECONDS * 1000);

    // Re-reads which rows survived the wait — an undo during it already
    // flipped its row to `cancelled` via cancelPendingDecisionEmails.
    const stillScheduled = await prisma.emailLog.findMany({
      where: { id: { in: prepared.map((p) => p.logId) }, status: 'scheduled' },
      select: { id: true },
    });
    const liveIds = new Set(stillScheduled.map((l) => l.id));
    const toSend = prepared.filter((p) => liveIds.has(p.logId));
    if (toSend.length === 0) return;

    await sendScheduledEmailBatch(toSend);
  } catch {
    // Already recorded as EmailLog rows — a batch failure must never undo the status change.
  }
}
