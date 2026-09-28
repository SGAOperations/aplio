import { BYPASS_USERS } from '@/lib/bypass-users';

import type { EmailLogDef } from './types';

// Curated EmailLog rows — every status in EmailStatus, across the templates
// in EmailTemplateKey. Subjects mirror lib/email/templates.ts (server-only,
// so this can't import it directly).
export const emailLogDefs: EmailLogDef[] = [
  // otp
  {
    template: 'otp',
    status: 'delivered',
    to: 'alice@example.com',
    userEmail: 'alice@example.com',
    subject: 'Your Aplio access code',
    hoursAgo: 30,
  },
  {
    template: 'otp',
    status: 'delivered',
    to: BYPASS_USERS.applicant.email,
    userEmail: BYPASS_USERS.applicant.email,
    subject: 'Your Aplio access code',
    hoursAgo: 0.5,
  },
  // No matching user — a bounce on an address that never became an account.
  {
    template: 'otp',
    status: 'bounced',
    to: 'jordan.lee@exampel.com',
    subject: 'Your Aplio access code',
    hoursAgo: 48,
    bounceType: 'Permanent',
  },

  // application_received
  {
    template: 'application_received',
    status: 'delivered',
    to: 'alice@example.com',
    userEmail: 'alice@example.com',
    application: {
      applicantEmail: 'alice@example.com',
      positionTitle: 'Senator — College of Engineering',
    },
    subject:
      'We received your application for Senator — College of Engineering',
    hoursAgo: 72,
  },
  {
    template: 'application_received',
    status: 'delivered',
    to: 'carol@example.com',
    userEmail: 'carol@example.com',
    application: {
      applicantEmail: 'carol@example.com',
      positionTitle: 'Senator — College of Engineering',
    },
    subject:
      'We received your application for Senator — College of Engineering',
    hoursAgo: 144,
  },
  {
    template: 'application_received',
    status: 'complained',
    to: 'bob@example.com',
    userEmail: 'bob@example.com',
    application: {
      applicantEmail: 'bob@example.com',
      positionTitle: 'Director of Finance',
    },
    subject: 'We received your application for Director of Finance',
    hoursAgo: 120,
  },
  {
    template: 'application_received',
    status: 'failed',
    to: 'david@example.com',
    userEmail: 'david@example.com',
    application: {
      applicantEmail: 'david@example.com',
      positionTitle: 'Director of Finance',
    },
    subject: 'We received your application for Director of Finance',
    hoursAgo: 96,
    error: 'Resend API error: rate limit exceeded',
  },
  {
    template: 'application_received',
    status: 'suppressed',
    to: 'kofi@example.com',
    userEmail: 'kofi@example.com',
    application: {
      applicantEmail: 'kofi@example.com',
      positionTitle: 'Senator — College of Engineering',
    },
    subject:
      'We received your application for Senator — College of Engineering',
    hoursAgo: 48,
  },
  {
    template: 'application_received',
    status: 'bounced',
    to: 'erin@example.com',
    userEmail: 'erin@example.com',
    application: {
      applicantEmail: 'erin@example.com',
      positionTitle: 'Senator — College of Engineering',
    },
    subject:
      'We received your application for Senator — College of Engineering',
    hoursAgo: 26,
    bounceType: 'Transient',
  },

  // application_accepted
  {
    template: 'application_accepted',
    status: 'delivered',
    to: BYPASS_USERS.applicant.email,
    userEmail: BYPASS_USERS.applicant.email,
    application: {
      applicantEmail: BYPASS_USERS.applicant.email,
      positionTitle: 'Director of Technology',
    },
    subject: 'Update on your application for Director of Technology',
    hoursAgo: 12 * 24,
  },
  {
    template: 'application_accepted',
    status: 'delivered',
    to: 'ivan@example.com',
    userEmail: 'ivan@example.com',
    application: {
      applicantEmail: 'ivan@example.com',
      positionTitle: 'Senator — College of Engineering',
    },
    subject: 'Update on your application for Senator — College of Engineering',
    hoursAgo: 24,
  },
  {
    template: 'application_accepted',
    status: 'sent',
    to: 'david@example.com',
    userEmail: 'david@example.com',
    application: {
      applicantEmail: 'david@example.com',
      positionTitle: 'Director of External Relations',
    },
    subject: 'Update on your application for Director of External Relations',
    hoursAgo: 1,
  },

  // application_rejected
  {
    template: 'application_rejected',
    status: 'cancelled',
    to: 'julia@example.com',
    userEmail: 'julia@example.com',
    application: {
      applicantEmail: 'julia@example.com',
      positionTitle: 'Senator — College of Engineering',
    },
    subject: 'Update on your application for Senator — College of Engineering',
    hoursAgo: 48,
  },
  // Still inside the undo window — reads as Scheduled.
  {
    template: 'application_rejected',
    status: 'scheduled',
    to: 'julia@example.com',
    userEmail: 'julia@example.com',
    application: {
      applicantEmail: 'julia@example.com',
      positionTitle: 'Senator — College of Engineering',
    },
    subject: 'Update on your application for Senator — College of Engineering',
    hoursAgo: 0,
  },
  {
    template: 'application_rejected',
    status: 'delivered',
    to: BYPASS_USERS.applicant.email,
    userEmail: BYPASS_USERS.applicant.email,
    application: {
      applicantEmail: BYPASS_USERS.applicant.email,
      positionTitle: 'Student Advocate',
    },
    subject: 'Update on your application for Student Advocate',
    hoursAgo: 15 * 24,
  },
  {
    template: 'application_rejected',
    status: 'bounced',
    to: 'carol@example.com',
    userEmail: 'carol@example.com',
    application: {
      applicantEmail: 'carol@example.com',
      positionTitle: 'Sustainability Chair',
    },
    subject: 'Update on your application for Sustainability Chair',
    hoursAgo: 88 * 24,
    bounceType: 'Permanent',
  },
  // A generated Orientation Leader applicant — pushes the log past 50 rows.
  {
    template: 'application_rejected',
    status: 'failed',
    to: 'orientation-49@example.com',
    userEmail: 'orientation-49@example.com',
    application: {
      applicantEmail: 'orientation-49@example.com',
      positionTitle: 'Orientation Leader',
    },
    subject: 'Update on your application for Orientation Leader',
    hoursAgo: 20 * 24,
  },

  // manager_daily_digest
  {
    template: 'manager_daily_digest',
    status: 'delivered',
    to: BYPASS_USERS['position-manager'].email,
    userEmail: BYPASS_USERS['position-manager'].email,
    subject: 'New applications for your positions',
    hoursAgo: 24,
  },
  {
    template: 'manager_daily_digest',
    status: 'delivered',
    to: 'david@example.com',
    userEmail: 'david@example.com',
    subject: 'New applications for your positions',
    hoursAgo: 48,
  },

  // manager_weekly_digest — both before the current org week, so the weekly gate stays open.
  {
    template: 'manager_weekly_digest',
    status: 'delivered',
    to: BYPASS_USERS['position-manager'].email,
    userEmail: BYPASS_USERS['position-manager'].email,
    subject: 'Your weekly manager digest',
    hoursAgo: 8 * 24,
  },
  {
    template: 'manager_weekly_digest',
    status: 'failed',
    to: 'david@example.com',
    userEmail: 'david@example.com',
    subject: 'Your weekly manager digest',
    hoursAgo: 8 * 24,
  },
];
