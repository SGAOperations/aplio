import 'server-only';

import {
  getDailyDigestRecipients,
  getWeeklyDigestRecipients,
} from '@/prisma/data/digests';

import { MANAGER_DIGEST_SEND_SPACING_MS } from '@/lib/constants';
import { delay } from '@/lib/delay';
import { sendEmail } from '@/lib/email/resend';
import {
  managerDailyDigestEmail,
  managerWeeklyDigestEmail,
} from '@/lib/email/templates';
import { getFirstName } from '@/lib/utils';

export interface DigestDispatchResult {
  sent: number;
  failed: number;
  skipped: number;
}

export async function dispatchDailyManagerDigests(
  now: Date = new Date(),
): Promise<DigestDispatchResult> {
  const { recipients, skipped } = await getDailyDigestRecipients(now);

  let sent = 0;
  let failed = 0;
  for (const recipient of recipients) {
    try {
      const { subject, html, text } = managerDailyDigestEmail({
        firstName: getFirstName(recipient.name),
        since: recipient.since,
        positions: recipient.positions,
        total: recipient.total,
      });
      await sendEmail({
        to: recipient.email,
        subject,
        html,
        text,
        template: 'manager_daily_digest',
        userId: recipient.userId,
      });
      sent += 1;
    } catch {
      // Already recorded as an EmailLog row by sendEmail — Vercel Cron does
      // not retry, so one bad address must not stop the rest of the run.
      failed += 1;
    }
    await delay(MANAGER_DIGEST_SEND_SPACING_MS);
  }

  return { sent, failed, skipped };
}

export async function dispatchWeeklyManagerDigests(
  now: Date = new Date(),
): Promise<DigestDispatchResult> {
  const { recipients, skipped } = await getWeeklyDigestRecipients(now);

  let sent = 0;
  let failed = 0;
  for (const recipient of recipients) {
    try {
      const { subject, html, text } = managerWeeklyDigestEmail({
        firstName: getFirstName(recipient.name),
        asOfDay: recipient.asOfDay,
        statusCounts: recipient.statusCounts,
        openPositions: recipient.openPositions,
      });
      await sendEmail({
        to: recipient.email,
        subject,
        html,
        text,
        template: 'manager_weekly_digest',
        userId: recipient.userId,
      });
      sent += 1;
    } catch {
      // Already recorded as an EmailLog row by sendEmail — Vercel Cron does
      // not retry, so one bad address must not stop the rest of the run.
      failed += 1;
    }
    await delay(MANAGER_DIGEST_SEND_SPACING_MS);
  }

  return { sent, failed, skipped };
}
