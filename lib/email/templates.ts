import 'server-only';

// Email templates for Neon Auth webhook events.
//
// Tailwind classes are ignored by email clients, so inline styles are used here.
// Logo is embedded as a base64 data URI so it renders without a hosted URL dependency.
// Red accent #D41B2C matches the Aplio logo; zinc tokens match the app design system.

const LOGO_DATA_URI =
  'data:image/png;base64,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';

// Prevent HTML injection in user-supplied values interpolated into email markup.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface LayoutOptions {
  title: string;
  content: string;
}

function emailLayout({ title, content }: LayoutOptions): string {
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
          <!-- Header -->
          <tr>
            <td style="padding-bottom:24px;" align="center">
              <img src="${LOGO_DATA_URI}" width="40" height="40" alt="Aplio" style="display:block;border-radius:8px;margin-bottom:10px;" />
              <span style="font-size:18px;font-weight:700;color:#18181b;letter-spacing:-0.01em;">Aplio</span>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;">
              <div style="height:4px;background:#D41B2C;"></div>
              <div style="padding:32px;">
                ${content}
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;font-size:12px;color:#71717a;text-align:center;">
              You received this email because a sign-in was initiated for your account.<br />
              If you did not request this, you can safely ignore this email.
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
  expiresInMinutes?: number;
}

export function otpEmail({
  code,
  expiresInMinutes,
}: OtpEmailOptions): EmailTemplate {
  const safeCode = escapeHtml(code);
  const expiryLine = expiresInMinutes
    ? `This code expires in ${expiresInMinutes} minute${expiresInMinutes === 1 ? '' : 's'}.`
    : '';

  const content = `
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#09090b;">Your sign-in code</h1>
    <p style="margin:0 0 24px;font-size:14px;color:#71717a;">Use the code below to sign in to Aplio.</p>
    <div style="border:2px solid #D41B2C;border-radius:6px;padding:20px;text-align:center;margin-bottom:24px;">
      <span style="font-size:36px;font-weight:700;letter-spacing:0.2em;color:#09090b;font-family:'Courier New',monospace;">${safeCode}</span>
    </div>
    ${expiryLine ? `<p style="margin:0;font-size:13px;color:#71717a;">${expiryLine}</p>` : ''}
  `;

  const textLines = [
    'Your Aplio sign-in code',
    '',
    `Code: ${code}`,
    ...(expiryLine ? [expiryLine] : []),
    '',
    'If you did not request this code, you can ignore this email.',
  ];

  return {
    subject: 'Your Aplio sign-in code',
    html: emailLayout({ title: 'Your Aplio sign-in code', content }),
    text: textLines.join('\n'),
  };
}

export interface MagicLinkEmailOptions {
  url: string;
  expiresInMinutes?: number;
}

export function magicLinkEmail({
  url,
  expiresInMinutes,
}: MagicLinkEmailOptions): EmailTemplate {
  const safeUrl = escapeHtml(url);
  const expiryLine = expiresInMinutes
    ? `This link expires in ${expiresInMinutes} minute${expiresInMinutes === 1 ? '' : 's'}.`
    : '';

  const content = `
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#09090b;">Sign in to Aplio</h1>
    <p style="margin:0 0 24px;font-size:14px;color:#71717a;">Click the button below to sign in to your account.</p>
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${safeUrl}" style="display:inline-block;background:#D41B2C;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:14px;font-weight:600;letter-spacing:0.01em;">Sign in to Aplio</a>
    </div>
    ${expiryLine ? `<p style="margin:0 0 16px;font-size:13px;color:#71717a;">${expiryLine}</p>` : ''}
    <p style="margin:0;font-size:12px;color:#71717a;">Or copy this link into your browser:<br /><span style="color:#09090b;word-break:break-all;">${safeUrl}</span></p>
  `;

  const textLines = [
    'Sign in to Aplio',
    '',
    `Open this link to sign in: ${url}`,
    ...(expiryLine ? [expiryLine] : []),
    '',
    'If you did not request this link, you can ignore this email.',
  ];

  return {
    subject: 'Sign in to Aplio',
    html: emailLayout({ title: 'Sign in to Aplio', content }),
    text: textLines.join('\n'),
  };
}
