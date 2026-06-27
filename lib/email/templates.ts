import 'server-only';

// Email templates for Neon Auth webhook events.
//
// Tailwind classes are ignored by email clients, so inline styles are used here.
// Hex values below correspond to the Aplio design tokens (see globals.css):
//   foreground ~ #09090b (zinc-950), muted ~ #71717a (zinc-500),
//   primary ~ #18181b (zinc-900), border ~ #e4e4e7 (zinc-200),
//   background ~ #ffffff.
// Using matching hex values (not Tailwind variables) is intentional for email.

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
            <td style="padding-bottom:24px;">
              <span style="font-size:18px;font-weight:700;color:#18181b;letter-spacing:-0.01em;">Aplio</span>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;font-size:12px;color:#71717a;text-align:center;">
              You received this email because a sign-in was initiated for your account.<br />
              If you did not request this, you can ignore this email.
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
    <div style="background:#f4f4f5;border-radius:6px;padding:20px;text-align:center;margin-bottom:24px;">
      <span style="font-size:36px;font-weight:700;letter-spacing:0.15em;color:#09090b;font-family:'Courier New',monospace;">${safeCode}</span>
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
    <p style="margin:0 0 24px;font-size:14px;color:#71717a;">Click the button below to sign in. The link will open your Aplio session.</p>
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${safeUrl}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;">Sign in to Aplio</a>
    </div>
    ${expiryLine ? `<p style="margin:0;font-size:13px;color:#71717a;">${expiryLine}</p>` : ''}
    <p style="margin:16px 0 0;font-size:12px;color:#71717a;">Or copy this link into your browser:<br /><span style="color:#09090b;word-break:break-all;">${safeUrl}</span></p>
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
