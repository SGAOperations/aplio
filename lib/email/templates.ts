import 'server-only';

// Email templates for Neon Auth webhook events.
//
// Tailwind classes are ignored by email clients, so inline styles are used here.
// Logo is embedded as a base64 data URI so it renders without a hosted URL dependency.
// Red accent #D41B2C matches the Aplio logo; zinc tokens match the app design system.

const LOGO_DATA_URI =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect width="512" height="512" rx="80" fill="#fbfbfb"/><path d="m93 156 100 100L93 356" stroke="#47191f" stroke-width="80" stroke-linecap="round" fill="none"/><path d="m206 156 100 100-100 100" stroke="#881924" stroke-width="80" stroke-linecap="round" fill="none"/><path d="m319 156 100 100-100 100" stroke="#d41b2c" stroke-width="80" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
  ).toString('base64');

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
                          <img src="${LOGO_DATA_URI}" width="34" height="34" alt="" style="display:block;border-radius:6px;" />
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
              You&#39;re receiving this because a sign-in was requested for your Aplio account.<br />
              Didn&#39;t request this? You can safely ignore it.
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
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#09090b;">Your access code</h1>
    <p style="margin:0 0 24px;font-size:14px;color:#71717a;">Enter this code to sign in to your Aplio account. It is single-use and will expire shortly.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #D41B2C;border-radius:6px;margin-bottom:24px;">
      <tr>
        <td style="padding:20px;text-align:center;">
          <span style="font-size:36px;font-weight:700;letter-spacing:0.2em;color:#09090b;font-family:'Courier New',monospace;">${safeCode}</span>
        </td>
      </tr>
    </table>
    ${expiryLine ? `<p style="margin:0;font-size:13px;color:#71717a;">${expiryLine}</p>` : ''}
  `;

  const textLines = [
    'Your Aplio access code',
    '',
    `Code: ${code}`,
    ...(expiryLine ? [expiryLine] : []),
    '',
    'If you did not request this code, you can ignore this email.',
  ];

  return {
    subject: 'Your Aplio access code',
    html: emailLayout({ title: 'Your Aplio access code', content }),
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
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#09090b;">Your sign-in link</h1>
    <p style="margin:0 0 24px;font-size:14px;color:#71717a;">Use the button below to sign in to your Aplio account &#8212; no password needed.</p>
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${safeUrl}" style="display:inline-block;background-color:#D41B2C;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:14px;font-weight:600;letter-spacing:0.01em;">Sign in to Aplio</a>
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
