import { describe, expect, it } from 'vitest';

import {
  APPLICANT_EMAIL_FOOTER,
  applicationAcceptedEmail,
  applicationReceivedEmail,
  applicationRejectedEmail,
  emailLayout,
  escapeHtml,
  otpEmail,
} from '@/lib/email/templates';

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

const DANGEROUS_TITLE = 'R&D <Lead>';

describe('applicationReceivedEmail', () => {
  it('renders the exact subject with the raw position title', () => {
    const result = applicationReceivedEmail({
      firstName: 'Jane',
      positionTitle: DANGEROUS_TITLE,
      applicationId: 'app-1',
    });
    expect(result.subject).toBe(
      `We received your application for ${DANGEROUS_TITLE}`,
    );
  });

  it('escapes the position title in the html but leaves it raw in the text body', () => {
    const result = applicationReceivedEmail({
      firstName: 'Jane',
      positionTitle: DANGEROUS_TITLE,
      applicationId: 'app-1',
    });
    expect(result.html).toContain(escapeHtml(DANGEROUS_TITLE));
    expect(result.html).not.toContain(DANGEROUS_TITLE);
    expect(result.text).toContain(DANGEROUS_TITLE);
  });

  it('greets by first name, falling back to "Hi there," with none', () => {
    expect(
      applicationReceivedEmail({
        positionTitle: 'Treasurer',
        applicationId: 'app-1',
      }).text,
    ).toContain('Hi there,');
    expect(
      applicationReceivedEmail({
        firstName: 'Jane',
        positionTitle: 'Treasurer',
        applicationId: 'app-1',
      }).text,
    ).toContain('Hi Jane,');
  });

  it('includes the applicant footer', () => {
    const result = applicationReceivedEmail({
      positionTitle: 'Treasurer',
      applicationId: 'app-1',
    });
    expect(result.html).toContain(APPLICANT_EMAIL_FOOTER);
  });
});

describe('applicationAcceptedEmail', () => {
  it('renders the exact subject with the raw position title', () => {
    const result = applicationAcceptedEmail({
      firstName: 'Jane',
      positionTitle: DANGEROUS_TITLE,
      applicationId: 'app-1',
    });
    expect(result.subject).toBe(
      `Your application for ${DANGEROUS_TITLE} was accepted`,
    );
  });

  it('escapes the position title in the html', () => {
    const result = applicationAcceptedEmail({
      firstName: 'Jane',
      positionTitle: DANGEROUS_TITLE,
      applicationId: 'app-1',
    });
    expect(result.html).toContain(escapeHtml(DANGEROUS_TITLE));
    expect(result.html).not.toContain(DANGEROUS_TITLE);
  });

  it('includes the applicant footer', () => {
    const result = applicationAcceptedEmail({
      positionTitle: 'Treasurer',
      applicationId: 'app-1',
    });
    expect(result.html).toContain(APPLICANT_EMAIL_FOOTER);
  });
});

describe('applicationRejectedEmail', () => {
  it('never reveals the outcome in the subject', () => {
    const result = applicationRejectedEmail({
      firstName: 'Jane',
      positionTitle: 'Treasurer',
    });
    expect(result.subject).toBe('Update on your application for Treasurer');
    expect(result.subject.toLowerCase()).not.toContain('reject');
  });

  it('escapes the position title in the html but leaves it raw in the subject', () => {
    const result = applicationRejectedEmail({
      firstName: 'Jane',
      positionTitle: DANGEROUS_TITLE,
    });
    expect(result.subject).toBe(
      `Update on your application for ${DANGEROUS_TITLE}`,
    );
    expect(result.html).toContain(escapeHtml(DANGEROUS_TITLE));
    expect(result.html).not.toContain(DANGEROUS_TITLE);
  });

  it('includes the applicant footer', () => {
    const result = applicationRejectedEmail({ positionTitle: 'Treasurer' });
    expect(result.html).toContain(APPLICANT_EMAIL_FOOTER);
  });
});
