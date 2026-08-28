import 'server-only';

import { getBaseUrl } from '@/lib/base-url';

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

export interface ApplicationAcceptedEmailOptions {
  firstName?: string;
  positionTitle: string;
  applicationId: string;
}

export function applicationAcceptedEmail({
  firstName,
  positionTitle,
  applicationId,
}: ApplicationAcceptedEmailOptions): EmailTemplate {
  const applicationUrl = `${getBaseUrl()}/my-applications/${applicationId}`;
  const safeGreeting = escapeHtml(greeting(firstName));
  const safeTitle = escapeHtml(positionTitle);

  const content = `
    <p style="margin:0 0 16px;font-size:14px;color:#09090b;">${safeGreeting}</p>
    <p style="margin:0 0 24px;font-size:14px;color:#71717a;">Good news — your application for <strong>${safeTitle}</strong> has been accepted.</p>
    ${primaryButton(applicationUrl, 'View my application')}
    <p style="margin:0;font-size:14px;color:#71717a;">Someone from student government will be in touch about next steps.</p>
  `;

  const text = [
    greeting(firstName),
    '',
    `Good news — your application for ${positionTitle} has been accepted.`,
    '',
    `View your application: ${applicationUrl}`,
    '',
    'Someone from student government will be in touch about next steps.',
  ].join('\n');

  return {
    subject: `Your application for ${positionTitle} was accepted`,
    html: emailLayout({
      title: 'Application accepted',
      content,
      footer: APPLICANT_EMAIL_FOOTER,
    }),
    text,
  };
}

export interface ApplicationRejectedEmailOptions {
  firstName?: string;
  positionTitle: string;
}

// Subject is deliberately neutral — never contains the outcome. See docs/WORKFLOWS.md XC-9.
export function applicationRejectedEmail({
  firstName,
  positionTitle,
}: ApplicationRejectedEmailOptions): EmailTemplate {
  const positionsUrl = `${getBaseUrl()}/positions`;
  const safeGreeting = escapeHtml(greeting(firstName));
  const safeTitle = escapeHtml(positionTitle);

  const content = `
    <p style="margin:0 0 16px;font-size:14px;color:#09090b;">${safeGreeting}</p>
    <p style="margin:0 0 16px;font-size:14px;color:#71717a;">Thank you for applying for <strong>${safeTitle}</strong>. After review, we won't be moving forward with your application this time.</p>
    <p style="margin:0 0 24px;font-size:14px;color:#71717a;">We know this is disappointing. Positions open throughout the year, and you're welcome to apply again.</p>
    ${primaryButton(positionsUrl, 'View open positions')}
  `;

  const text = [
    greeting(firstName),
    '',
    `Thank you for applying for ${positionTitle}. After review, we won't be moving forward with your application this time.`,
    '',
    "We know this is disappointing. Positions open throughout the year, and you're welcome to apply again.",
    '',
    `View open positions: ${positionsUrl}`,
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
