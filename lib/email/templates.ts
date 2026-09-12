import 'server-only';

import { type $Enums } from '@/prisma/client';

import { getBaseUrl } from '@/lib/base-url';
import { APPLICATION_STATUS_LABELS, ORG_TIMEZONE } from '@/lib/constants';
import { formatInstant, orgDayStart } from '@/lib/dates';
import {
  type ManagerDigestPosition,
  type WeeklyDigestStatusCount,
} from '@/lib/types';

// Inline styles throughout: email clients ignore Tailwind classes.

// Prevent HTML injection in user-supplied values interpolated into email markup.
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface LayoutOptions {
  title: string;
  content: string;
  footer: string;
}

export function emailLayout({ title, content, footer }: LayoutOptions): string {
  const logoUrl = `${getBaseUrl()}/logo-512.svg`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <!-- Card -->
          <tr>
            <td>
              <table width="100%" cellpadding="0" cellspacing="0">
                <!-- Branded red header -->
                <tr>
                  <td bgcolor="#D41B2C" style="background-color:#D41B2C;padding:20px 28px;border-radius:10px 10px 0 0;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align:middle;padding-right:10px;">
                          <img src="${logoUrl}" width="34" height="34" alt="" style="display:block;border-radius:6px;" />
                        </td>
                        <td style="vertical-align:middle;">
                          <span style="font-size:17px;font-weight:700;color:#ffffff;letter-spacing:-0.01em;">Aplio</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- White card body -->
                <tr>
                  <td bgcolor="#ffffff" style="background-color:#ffffff;padding:32px;border:1px solid #e4e4e7;border-top:none;border-radius:0 0 10px 10px;">
                    ${content}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;font-size:12px;color:#71717a;text-align:center;">
              ${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface OtpEmailOptions {
  code: string;
  signInUrl: string;
  expiresInMinutes?: number;
}

// Author-written HTML, never user input — safe to interpolate unescaped.
const OTP_FOOTER = `You&#39;re receiving this because a sign-in was requested for your Aplio account.<br />
              Didn&#39;t request this? You can safely ignore it.`;

export function otpEmail({
  code,
  signInUrl,
  expiresInMinutes,
}: OtpEmailOptions): EmailTemplate {
  const safeCode = escapeHtml(code);
  const safeSignInUrl = escapeHtml(signInUrl);
  const expiryLine = expiresInMinutes
    ? `This code expires in ${expiresInMinutes} minute${expiresInMinutes === 1 ? '' : 's'}.`
    : '';

  const content = `
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#09090b;">Your access code</h1>
    <p style="margin:0 0 24px;font-size:14px;color:#71717a;">Enter this code to sign in to your Aplio account — or use the button below to sign in directly. It is single-use and will expire shortly.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #D41B2C;border-radius:6px;margin-bottom:24px;">
      <tr>
        <td style="padding:20px;text-align:center;">
          <span style="font-size:36px;font-weight:700;letter-spacing:0.2em;color:#09090b;font-family:'Courier New',monospace;">${safeCode}</span>
        </td>
      </tr>
    </table>
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${safeSignInUrl}" style="display:inline-block;background-color:#D41B2C;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:14px;font-weight:600;letter-spacing:0.01em;">Sign in to Aplio</a>
    </div>
    <p style="margin:0 0 24px;font-size:12px;color:#71717a;">Button not working? Copy this link into your browser:<br /><span style="color:#09090b;word-break:break-all;">${safeSignInUrl}</span></p>
    ${expiryLine ? `<p style="margin:0;font-size:13px;color:#71717a;">${expiryLine}</p>` : ''}
  `;

  const textLines = [
    'Your Aplio access code',
    '',
    `Code: ${code}`,
    `Or open this link to sign in: ${signInUrl}`,
    ...(expiryLine ? [expiryLine] : []),
    '',
    'If you did not request this code, you can ignore this email.',
  ];

  return {
    subject: 'Your Aplio access code',
    html: emailLayout({
      title: 'Your Aplio access code',
      content,
      footer: OTP_FOOTER,
    }),
    text: textLines.join('\n'),
  };
}

export const APPLICANT_EMAIL_FOOTER =
  'You&#39;re receiving this because you applied for a position through Aplio.';

// Raw text — callers escapeHtml() the whole line for the html body; the text body uses it as-is.
function greeting(firstName?: string): string {
  return firstName ? `Hi ${firstName},` : 'Hi there,';
}

function primaryButton(url: string, label: string): string {
  const safeUrl = escapeHtml(url);
  return `
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${safeUrl}" style="display:inline-block;background-color:#D41B2C;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:14px;font-weight:600;letter-spacing:0.01em;">${label}</a>
    </div>
    <p style="margin:0 0 24px;font-size:12px;color:#71717a;">Button not working? Copy this link into your browser:<br /><span style="color:#09090b;word-break:break-all;">${safeUrl}</span></p>`;
}

export interface ApplicationReceivedEmailOptions {
  firstName?: string;
  positionTitle: string;
  applicationId: string;
}

export function applicationReceivedEmail({
  firstName,
  positionTitle,
  applicationId,
}: ApplicationReceivedEmailOptions): EmailTemplate {
  const applicationUrl = `${getBaseUrl()}/my-applications/${applicationId}`;
  const safeGreeting = escapeHtml(greeting(firstName));
  const safeTitle = escapeHtml(positionTitle);

  const content = `
    <p style="margin:0 0 16px;font-size:14px;color:#09090b;">${safeGreeting}</p>
    <p style="margin:0 0 16px;font-size:14px;color:#71717a;">Your application for <strong>${safeTitle}</strong> has been received. Nothing further is needed from you right now.</p>
    <p style="margin:0 0 24px;font-size:14px;color:#71717a;">You can review what you submitted at any time, and you can withdraw the application while it's still under consideration.</p>
    ${primaryButton(applicationUrl, 'View my application')}
    <p style="margin:0;font-size:14px;color:#71717a;">We'll email you when a decision has been made.</p>
  `;

  const text = [
    greeting(firstName),
    '',
    `Your application for ${positionTitle} has been received. Nothing further is needed from you right now.`,
    '',
    "You can review what you submitted at any time, and you can withdraw the application while it's still under consideration.",
    '',
    `View your application: ${applicationUrl}`,
    '',
    "We'll email you when a decision has been made.",
  ].join('\n');

  return {
    subject: `We received your application for ${positionTitle}`,
    html: emailLayout({
      title: 'Application received',
      content,
      footer: APPLICANT_EMAIL_FOOTER,
    }),
    text,
  };
}

export interface ApplicationDecisionEmailOptions {
  firstName?: string;
  positionTitle: string;
  applicationId: string;
}

// Subject and body never state the decision — the EmailLog template does (docs/WORKFLOWS.md XC-9).
export function applicationDecisionEmail({
  firstName,
  positionTitle,
  applicationId,
}: ApplicationDecisionEmailOptions): EmailTemplate {
  const applicationUrl = `${getBaseUrl()}/my-applications/${applicationId}`;
  const safeGreeting = escapeHtml(greeting(firstName));
  const safeTitle = escapeHtml(positionTitle);

  const content = `
    <p style="margin:0 0 16px;font-size:14px;color:#09090b;">${safeGreeting}</p>
    <p style="margin:0 0 16px;font-size:14px;color:#71717a;">There's an update on your application for <strong>${safeTitle}</strong>.</p>
    <p style="margin:0 0 24px;font-size:14px;color:#71717a;">Open your application to see its current status.</p>
    ${primaryButton(applicationUrl, 'View my application')}
  `;

  const text = [
    greeting(firstName),
    '',
    `There's an update on your application for ${positionTitle}.`,
    '',
    'Open your application to see its current status.',
    '',
    `View your application: ${applicationUrl}`,
  ].join('\n');

  return {
    subject: `Update on your application for ${positionTitle}`,
    html: emailLayout({
      title: 'Application update',
      content,
      footer: APPLICANT_EMAIL_FOOTER,
    }),
    text,
  };
}

export const MANAGER_EMAIL_FOOTER =
  'You&#39;re receiving this because you manage one or more positions on Aplio.';

function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

function formatDigestDay(day: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: ORG_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(orgDayStart(day));
}

export interface ManagerDailyDigestEmailOptions {
  firstName?: string;
  since: Date;
  positions: ManagerDigestPosition[];
  total: number;
}

// `since` is an instant, not a calendar day — the window is "since your last
// digest," which can span more than a day after a missed/delayed run, so the
// copy names the exact moment rather than a single date.
export function managerDailyDigestEmail({
  firstName,
  since,
  positions,
  total,
}: ManagerDailyDigestEmailOptions): EmailTemplate {
  const baseUrl = getBaseUrl();
  const allApplicationsUrl = `${baseUrl}/manage/applications`;
  const sinceLabel = formatInstant(since, {
    precision: 'datetime',
    timeZone: ORG_TIMEZONE,
  });
  const safeGreeting = escapeHtml(greeting(firstName));

  const subject =
    positions.length === 1
      ? `${total} new ${pluralize(total, 'application')} for ${positions[0]!.title}`
      : `${total} new applications across ${positions.length} positions`;

  const positionRows = positions
    .map((position) => {
      const url = `${allApplicationsUrl}?positionId=${position.positionId}`;
      return `<p style="margin:0 0 8px;font-size:14px;color:#09090b;"><a href="${escapeHtml(url)}" style="color:#D41B2C;text-decoration:none;font-weight:600;">${escapeHtml(position.title)}</a> — ${position.newApplications} new ${pluralize(position.newApplications, 'application')}</p>`;
    })
    .join('\n');

  const content = `
    <p style="margin:0 0 16px;font-size:14px;color:#09090b;">${safeGreeting}</p>
    <p style="margin:0 0 16px;font-size:14px;color:#71717a;">New applications on the positions you manage, since <strong>${escapeHtml(sinceLabel)}</strong>.</p>
    <div style="margin:0 0 24px;">${positionRows}</div>
    ${primaryButton(allApplicationsUrl, 'Review all applications')}
  `;

  const text = [
    greeting(firstName),
    '',
    `New applications on the positions you manage, since ${sinceLabel}.`,
    '',
    ...positions.map(
      (position) =>
        `${position.title} — ${position.newApplications} new ${pluralize(position.newApplications, 'application')}: ${allApplicationsUrl}?positionId=${position.positionId}`,
    ),
    '',
    `Review all applications: ${allApplicationsUrl}`,
  ].join('\n');

  return {
    subject,
    html: emailLayout({
      title: 'Manager daily digest',
      content,
      footer: MANAGER_EMAIL_FOOTER,
    }),
    text,
  };
}

// Matches the in-app status-dot palette — reviewing is the sole 'warning'
// (APPLICATION_STATUS_BADGE_VARIANT), the rest are 'info'.
const DIGEST_STATUS_DOT_COLOR: Partial<
  Record<$Enums.ApplicationStatus, string>
> = {
  applied: '#2563eb',
  reached_out: '#2563eb',
  interview_scheduled: '#2563eb',
  reviewing: '#d97706',
};

// A single stat box: dot + big number + label, linking to the filtered queue.
// Table-based, not flex/grid — Outlook's Word engine only renders tables reliably.
function statBox(
  url: string,
  color: string,
  count: number,
  label: string,
): string {
  const safeUrl = escapeHtml(url);
  return `<td width="50%" style="padding:4px;">
      <a href="${safeUrl}" style="display:block;text-decoration:none;background-color:#f4f4f5;border-radius:8px;padding:16px;text-align:center;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:${color};margin-bottom:6px;"></span><br />
        <span style="display:block;font-size:24px;font-weight:700;color:#09090b;line-height:1.2;">${count}</span>
        <span style="display:block;font-size:12px;color:#71717a;margin-top:2px;">${escapeHtml(label)}</span>
      </a>
    </td>`;
}

// Two boxes per row (UNRESOLVED_APPLICATION_STATUSES never exceeds four), a
// blank spacer cell keeps the last row's alignment when the count is odd.
function statBoxGrid(
  entries: { url: string; color: string; count: number; label: string }[],
): string {
  const rows: string[] = [];
  for (let i = 0; i < entries.length; i += 2) {
    const a = entries[i]!;
    const b = entries[i + 1];
    rows.push(
      `<tr>${statBox(a.url, a.color, a.count, a.label)}${b ? statBox(b.url, b.color, b.count, b.label) : '<td width="50%">&nbsp;</td>'}</tr>`,
    );
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">${rows.join('')}</table>`;
}

export interface ManagerWeeklyDigestEmailOptions {
  firstName?: string;
  asOfDay: string;
  statusCounts: WeeklyDigestStatusCount[];
  openPositions: Pick<ManagerDigestPosition, 'positionId' | 'title'>[];
}

// statusCounts is always unresolved-only (WeeklyDigestRecipient's contract) —
// this is a reminder of outstanding review work, never a terminal-decision recap.
export function managerWeeklyDigestEmail({
  firstName,
  asOfDay,
  statusCounts,
  openPositions,
}: ManagerWeeklyDigestEmailOptions): EmailTemplate {
  const baseUrl = getBaseUrl();
  const allApplicationsUrl = `${baseUrl}/manage/applications`;
  const asOfLabel = formatDigestDay(asOfDay);
  const safeGreeting = escapeHtml(greeting(firstName));
  const total = statusCounts.reduce((sum, entry) => sum + entry.count, 0);

  const subject = `${total} ${pluralize(total, 'application')} awaiting your review`;

  const statBoxesHtml = statBoxGrid(
    statusCounts.map((entry) => ({
      url: `${allApplicationsUrl}?status=${entry.status}`,
      color: DIGEST_STATUS_DOT_COLOR[entry.status] ?? '#71717a',
      count: entry.count,
      label: APPLICATION_STATUS_LABELS[entry.status],
    })),
  );

  const openPositionsLine =
    openPositions.length > 0
      ? openPositions
          .map((position) => {
            const url = `${allApplicationsUrl}?positionId=${position.positionId}`;
            return `<a href="${escapeHtml(url)}" style="color:#D41B2C;text-decoration:none;font-weight:600;">${escapeHtml(position.title)}</a>`;
          })
          .join(' · ')
      : 'You have no positions open right now.';

  const content = `
    <p style="margin:0 0 16px;font-size:14px;color:#09090b;">${safeGreeting}</p>
    <p style="margin:0 0 20px;font-size:14px;color:#71717a;">As of <strong>${escapeHtml(asOfLabel)}</strong>, you have ${total} ${pluralize(total, 'application')} awaiting review across the positions you manage.</p>
    ${statBoxesHtml}
    <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#09090b;">Your open positions</p>
    <p style="margin:0 0 24px;font-size:14px;color:#71717a;">${openPositionsLine}</p>
    ${primaryButton(allApplicationsUrl, 'Review all applications')}
  `;

  const text = [
    greeting(firstName),
    '',
    `As of ${asOfLabel}, you have ${total} ${pluralize(total, 'application')} awaiting review across the positions you manage.`,
    '',
    ...statusCounts.map(
      (entry) =>
        `${APPLICATION_STATUS_LABELS[entry.status]}: ${entry.count} — ${allApplicationsUrl}?status=${entry.status}`,
    ),
    '',
    'Your open positions',
    openPositions.length > 0
      ? openPositions
          .map(
            (position) =>
              `${position.title}: ${allApplicationsUrl}?positionId=${position.positionId}`,
          )
          .join('\n')
      : 'You have no positions open right now.',
    '',
    `Review all applications: ${allApplicationsUrl}`,
  ].join('\n');

  return {
    subject,
    html: emailLayout({
      title: 'Manager weekly digest',
      content,
      footer: MANAGER_EMAIL_FOOTER,
    }),
    text,
  };
}
