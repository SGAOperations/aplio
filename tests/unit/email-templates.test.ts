import { describe, expect, it } from 'vitest';

import { emailLayout, escapeHtml, otpEmail } from '@/lib/email/templates';

describe('escapeHtml', () => {
  it('escapes &, <, >, ", and \'', () => {
    expect(escapeHtml(`& < > " '`)).toBe('&amp; &lt; &gt; &quot; &#39;');
  });
});

describe('emailLayout', () => {
  it('requires footer', () => {
    // @ts-expect-error footer is required
    const html = emailLayout({ title: 'x', content: 'y' });
    expect(html).toContain('<title>x</title>');
  });
});

describe('otpEmail', () => {
  const options = {
    code: '123456',
    signInUrl: 'https://apply.northeasternsga.com/login?email=a&otp=123456',
    expiresInMinutes: 10,
  };

  it('renders the exact subject and text body', () => {
    const result = otpEmail(options);
    expect(result.subject).toBe('Your Aplio access code');
    expect(result.text).toBe(
      [
        'Your Aplio access code',
        '',
        'Code: 123456',
        `Or open this link to sign in: ${options.signInUrl}`,
        'This code expires in 10 minutes.',
        '',
        'If you did not request this code, you can ignore this email.',
      ].join('\n'),
    );
  });

  it('includes the escaped code and sign-in URL in the html', () => {
    const result = otpEmail(options);
    expect(result.html).toContain('123456');
    expect(result.html).toContain(escapeHtml(options.signInUrl));
  });

  it('includes both footer sentences', () => {
    const result = otpEmail(options);
    expect(result.html).toContain(
      'You&#39;re receiving this because a sign-in was requested for your Aplio account.',
    );
    expect(result.html).toContain(
      'Didn&#39;t request this? You can safely ignore it.',
    );
  });
});
