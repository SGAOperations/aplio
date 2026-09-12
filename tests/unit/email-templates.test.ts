import { describe, expect, it } from 'vitest';

import {
  APPLICANT_EMAIL_FOOTER,
  MANAGER_EMAIL_FOOTER,
  applicationDecisionEmail,
  applicationReceivedEmail,
  emailLayout,
  escapeHtml,
  managerDailyDigestEmail,
  managerWeeklyDigestEmail,
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

describe('applicationDecisionEmail', () => {
  it('renders the exact neutral subject with the raw position title', () => {
    const result = applicationDecisionEmail({
      firstName: 'Jane',
      positionTitle: DANGEROUS_TITLE,
      applicationId: 'app-1',
    });
    expect(result.subject).toBe(
      `Update on your application for ${DANGEROUS_TITLE}`,
    );
  });

  it('never reveals the outcome in the subject, html, or text', () => {
    const result = applicationDecisionEmail({
      firstName: 'Jane',
      positionTitle: 'Treasurer',
      applicationId: 'app-1',
    });
    expect(result.subject).not.toMatch(/accept|reject/i);
    expect(result.html).not.toMatch(/accept|reject/i);
    expect(result.text).not.toMatch(/accept|reject/i);
  });

  it('escapes the position title in the html but leaves it raw in the subject and text', () => {
    const result = applicationDecisionEmail({
      firstName: 'Jane',
      positionTitle: DANGEROUS_TITLE,
      applicationId: 'app-1',
    });
    expect(result.subject).toBe(
      `Update on your application for ${DANGEROUS_TITLE}`,
    );
    expect(result.html).toContain(escapeHtml(DANGEROUS_TITLE));
    expect(result.html).not.toContain(DANGEROUS_TITLE);
    expect(result.text).toContain(DANGEROUS_TITLE);
  });

  it('greets by first name, falling back to "Hi there," with none', () => {
    expect(
      applicationDecisionEmail({
        positionTitle: 'Treasurer',
        applicationId: 'app-1',
      }).text,
    ).toContain('Hi there,');
    expect(
      applicationDecisionEmail({
        firstName: 'Jane',
        positionTitle: 'Treasurer',
        applicationId: 'app-1',
      }).text,
    ).toContain('Hi Jane,');
  });

  it("links to the applicant's own application and includes the applicant footer", () => {
    const result = applicationDecisionEmail({
      positionTitle: 'Treasurer',
      applicationId: 'app-1',
    });
    expect(result.html).toContain('/my-applications/app-1');
    expect(result.html).toContain(APPLICANT_EMAIL_FOOTER);
  });
});

describe('managerDailyDigestEmail', () => {
  it('singularizes the subject and body at exactly 1', () => {
    const result = managerDailyDigestEmail({
      firstName: 'Jane',
      day: '2026-03-02',
      positions: [
        { positionId: 'pos-1', title: 'Treasurer', newApplications: 1 },
      ],
      total: 1,
    });
    expect(result.subject).toBe('1 new application for Treasurer');
    expect(result.html).toContain('1 new application<');
  });

  it('names the single position in the subject, pluralized', () => {
    const result = managerDailyDigestEmail({
      day: '2026-03-02',
      positions: [
        { positionId: 'pos-1', title: 'Treasurer', newApplications: 3 },
      ],
      total: 3,
    });
    expect(result.subject).toBe('3 new applications for Treasurer');
  });

  it('summarizes across positions in the subject when there is more than one', () => {
    const result = managerDailyDigestEmail({
      day: '2026-03-02',
      positions: [
        { positionId: 'pos-1', title: 'Senator', newApplications: 3 },
        { positionId: 'pos-2', title: 'Treasurer', newApplications: 2 },
      ],
      total: 5,
    });
    expect(result.subject).toBe('5 new applications across 2 positions');
  });

  it('escapes a dangerous position title in the html but leaves the subject raw', () => {
    const result = managerDailyDigestEmail({
      day: '2026-03-02',
      positions: [
        { positionId: 'pos-1', title: DANGEROUS_TITLE, newApplications: 1 },
      ],
      total: 1,
    });
    expect(result.subject).toBe(`1 new application for ${DANGEROUS_TITLE}`);
    expect(result.html).toContain(escapeHtml(DANGEROUS_TITLE));
    expect(result.html).not.toContain(DANGEROUS_TITLE);
    expect(result.text).toContain(DANGEROUS_TITLE);
  });

  it('links every position row to its own positionId', () => {
    const result = managerDailyDigestEmail({
      day: '2026-03-02',
      positions: [
        { positionId: 'pos-1', title: 'Senator', newApplications: 3 },
        { positionId: 'pos-2', title: 'Treasurer', newApplications: 2 },
      ],
      total: 5,
    });
    expect(result.html).toContain('?positionId=pos-1');
    expect(result.html).toContain('?positionId=pos-2');
    expect(result.text).toContain('?positionId=pos-1');
    expect(result.text).toContain('?positionId=pos-2');
  });

  it('names the org day and includes the manager footer', () => {
    const result = managerDailyDigestEmail({
      day: '2026-03-02',
      positions: [
        { positionId: 'pos-1', title: 'Treasurer', newApplications: 1 },
      ],
      total: 1,
    });
    expect(result.html).toContain('Mar 2, 2026');
    expect(result.html).toContain(MANAGER_EMAIL_FOOTER);
  });
});

describe('managerWeeklyDigestEmail', () => {
  const base = { asOfDay: '2026-03-09', openPositions: [] };

  it('sums the unresolved statuses into the subject, pluralized', () => {
    const result = managerWeeklyDigestEmail({
      ...base,
      statusCounts: [
        { status: 'applied', count: 7 },
        { status: 'reviewing', count: 3 },
      ],
    });
    expect(result.subject).toBe('10 applications awaiting your review');
  });

  it('singularizes the subject at exactly 1', () => {
    const result = managerWeeklyDigestEmail({
      ...base,
      statusCounts: [{ status: 'applied', count: 1 }],
    });
    expect(result.subject).toBe('1 application awaiting your review');
  });

  it('renders a stat box per status, linked by status value', () => {
    const result = managerWeeklyDigestEmail({
      ...base,
      statusCounts: [
        { status: 'applied', count: 7 },
        { status: 'reviewing', count: 3 },
      ],
    });
    expect(result.html).toContain('?status=applied');
    expect(result.html).toContain('?status=reviewing');
    expect(result.html).toContain('>7<');
    expect(result.html).toContain('>3<');
    expect(result.html).toContain('Applied');
    expect(result.html).toContain('Reviewing');
  });

  it('shows the empty open-positions line with none open', () => {
    const result = managerWeeklyDigestEmail({
      ...base,
      statusCounts: [{ status: 'applied', count: 1 }],
    });
    expect(result.html).toContain('You have no positions open right now.');
  });

  it('links open positions by positionId', () => {
    const result = managerWeeklyDigestEmail({
      ...base,
      statusCounts: [{ status: 'applied', count: 1 }],
      openPositions: [
        { positionId: 'pos-1', title: 'Senator' },
        { positionId: 'pos-2', title: 'Treasurer' },
      ],
    });
    expect(result.html).toContain('?positionId=pos-1');
    expect(result.html).toContain('?positionId=pos-2');
  });

  it('includes the as-of date and the manager footer', () => {
    const result = managerWeeklyDigestEmail({
      ...base,
      statusCounts: [{ status: 'applied', count: 1 }],
    });
    expect(result.html).toContain('Mar 9, 2026');
    expect(result.html).toContain(MANAGER_EMAIL_FOOTER);
  });
});
