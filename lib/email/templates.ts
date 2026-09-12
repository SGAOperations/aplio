import 'server-only';

import { getBaseUrl } from '@/lib/base-url';
import {
  APPLICATION_STATUS_LABELS,
  ORG_TIMEZONE,
  UNRESOLVED_APPLICATION_STATUSES,
} from '@/lib/constants';
import { orgDayStart } from '@/lib/dates';
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

function formatDigestWeekRange(startDay: string, endDay: string): string {
  // Only the start label carries the year conditionally — a week spanning a
  // year boundary would otherwise read ambiguously (Dec 29 – Jan 4, 2027).
  const crossesYear = startDay.slice(0, 4) !== endDay.slice(0, 4);
  const startLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: ORG_TIMEZONE,
    month: 'short',
    day: 'numeric',
    ...(crossesYear ? { year: 'numeric' } : {}),
  }).format(orgDayStart(startDay));
  const endLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: ORG_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(orgDayStart(endDay));
  return `${startLabel} – ${endLabel}`;
}

export interface ManagerDailyDigestEmailOptions {
  firstName?: string;
  day: string;
  positions: ManagerDigestPosition[];
  total: number;
}

export function managerDailyDigestEmail({
  firstName,
  day,
  positions,
  total,
}: ManagerDailyDigestEmailOptions): EmailTemplate {
  const baseUrl = getBaseUrl();
  const allApplicationsUrl = `${baseUrl}/manage/applications`;
  const dayLabel = formatDigestDay(day);
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
    <p style="margin:0 0 16px;font-size:14px;color:#71717a;">New applications on the positions you manage, from <strong>${escapeHtml(dayLabel)}</strong>.</p>
    <div style="margin:0 0 24px;">${positionRows}</div>
    ${primaryButton(allApplicationsUrl, 'Review all applications')}
  `;

  const text = [
    greeting(firstName),
    '',
    `New applications on the positions you manage, from ${dayLabel}.`,
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

export interface ManagerWeeklyDigestEmailOptions {
  firstName?: string;
  weekStart: string;
  weekEnd: string;
  newApplications: number;
  statusCounts: WeeklyDigestStatusCount[];
  openPositions: Pick<ManagerDigestPosition, 'positionId' | 'title'>[];
}

export function managerWeeklyDigestEmail({
  firstName,
  weekStart,
  weekEnd,
  newApplications,
  statusCounts,
  openPositions,
}: ManagerWeeklyDigestEmailOptions): EmailTemplate {
  const baseUrl = getBaseUrl();
  const allApplicationsUrl = `${baseUrl}/manage/applications`;
  const weekRangeLabel = formatDigestWeekRange(weekStart, weekEnd);
  const safeGreeting = escapeHtml(greeting(firstName));
  const unresolvedStatuses: readonly string[] = UNRESOLVED_APPLICATION_STATUSES;
  const unresolvedTotal = statusCounts
    .filter((entry) => unresolvedStatuses.includes(entry.status))
    .reduce((sum, entry) => sum + entry.count, 0);

  const subject =
    newApplications > 0
      ? `Your week on Aplio: ${newApplications} new ${pluralize(newApplications, 'application')}`
      : `Your week on Aplio: ${unresolvedTotal} ${pluralize(unresolvedTotal, 'application')} awaiting review`;

  const newThisWeekLine =
    newApplications > 0
      ? `${newApplications} new ${pluralize(newApplications, 'application')} across the positions you manage.`
      : 'No new applications this week.';

  const statusRows =
    statusCounts.length > 0
      ? statusCounts
          .map((entry) => {
            const url = `${allApplicationsUrl}?status=${entry.status}`;
            return `<a href="${escapeHtml(url)}" style="color:#D41B2C;text-decoration:none;font-weight:600;">${escapeHtml(APPLICATION_STATUS_LABELS[entry.status])}</a> — ${entry.count}`;
          })
          .join('<br />')
      : 'No applications on your positions yet.';

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
    <p style="margin:0 0 16px;font-size:14px;color:#71717a;">Your weekly summary for <strong>${escapeHtml(weekRangeLabel)}</strong>.</p>
    <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#09090b;">New this week</p>
    <p style="margin:0 0 16px;font-size:14px;color:#71717a;">${escapeHtml(newThisWeekLine)}</p>
    <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#09090b;">Where things stand</p>
    <p style="margin:0 0 16px;font-size:14px;color:#71717a;">${statusRows}</p>
    <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#09090b;">Your open positions</p>
    <p style="margin:0 0 24px;font-size:14px;color:#71717a;">${openPositionsLine}</p>
    ${primaryButton(allApplicationsUrl, 'Review all applications')}
  `;

  const text = [
    greeting(firstName),
    '',
    `Your weekly summary for ${weekRangeLabel}.`,
    '',
    'New this week',
    newThisWeekLine,
    '',
    'Where things stand',
    statusCounts.length > 0
      ? statusCounts
          .map(
            (entry) =>
              `${APPLICATION_STATUS_LABELS[entry.status]} (${allApplicationsUrl}?status=${entry.status}) — ${entry.count}`,
          )
          .join('\n')
      : 'No applications on your positions yet.',
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
