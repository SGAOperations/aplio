import { BYPASS_USERS } from '@/lib/bypass-users';

import type { ApplicationDef } from './types';

// Every ApplicationStatus appears once, plus the deliberate edge cases below.
export const applicationDefs: ApplicationDef[] = [
  {
    applicantEmail: BYPASS_USERS.applicant.email,
    positionTitle: 'Senator — College of Engineering',
    status: 'draft',
    answers: 'partial',
  },
  {
    applicantEmail: BYPASS_USERS.applicant.email,
    positionTitle: 'Director of Finance',
    status: 'applied',
    submittedInDays: 1,
    answers: 'full',
  },
  {
    applicantEmail: BYPASS_USERS.applicant.email,
    positionTitle: 'Director of Technology',
    status: 'accepted',
    submittedInDays: 20,
    answers: 'full',
  },
  {
    applicantEmail: BYPASS_USERS.applicant.email,
    positionTitle: 'Director of External Relations',
    status: 'withdrawn',
    submittedInDays: 30,
    answers: 'full',
  },
  {
    applicantEmail: BYPASS_USERS.applicant.email,
    positionTitle: 'Student Advocate',
    status: 'rejected',
    submittedInDays: 45,
    answers: 'full',
  },
  // Blocked by the incomplete profile, not by this application's answers.
  {
    applicantEmail: BYPASS_USERS['position-manager'].email,
    positionTitle: 'Director of Technology',
    status: 'draft',
    answers: 'full',
  },
  {
    applicantEmail: 'alice@example.com',
    positionTitle: 'Senator — College of Engineering',
    status: 'applied',
    submittedInDays: 3,
    answers: 'full',
  },
  {
    applicantEmail: 'alice@example.com',
    positionTitle: 'Director of Technology',
    status: 'reviewing',
    submittedInDays: 8,
    answers: 'full',
  },
  // Position is soft-deleted — must be invisible everywhere despite this row.
  {
    applicantEmail: 'alice@example.com',
    positionTitle: 'Elections Commissioner',
    status: 'applied',
    submittedInDays: 8,
    answers: 'full',
  },
  // Draft on the same soft-deleted position; must stay invisible everywhere.
  {
    applicantEmail: 'carol@example.com',
    positionTitle: 'Elections Commissioner',
    status: 'draft',
    answers: 'partial',
  },
  {
    applicantEmail: 'bob@example.com',
    positionTitle: 'Director of Finance',
    status: 'reached_out',
    submittedInDays: 5,
    answers: 'full',
  },
  {
    applicantEmail: 'bob@example.com',
    positionTitle: 'Student Advocate',
    status: 'interview_scheduled',
    submittedInDays: 40,
    answers: 'full',
  },
  {
    applicantEmail: 'carol@example.com',
    positionTitle: 'Senator — College of Engineering',
    status: 'interview_scheduled',
    submittedInDays: 6,
    answers: 'full',
  },
  // Its only application, and terminal, so the position drops out of both windows.
  {
    applicantEmail: 'carol@example.com',
    positionTitle: 'Sustainability Chair',
    status: 'rejected',
    submittedInDays: 95,
    answers: 'full',
  },
  // David also manages Director of Finance (see managerEmails in positions.ts).
  {
    applicantEmail: 'david@example.com',
    positionTitle: 'Director of Finance',
    status: 'reviewing',
    submittedInDays: 4,
    answers: 'full',
  },
  {
    applicantEmail: 'david@example.com',
    positionTitle: 'Director of External Relations',
    status: 'accepted',
    submittedInDays: 25,
    answers: 'full',
  },
  // Applicant is deactivated (deletedAt set) — the application itself stays.
  {
    applicantEmail: 'erin@example.com',
    positionTitle: 'Senator — College of Engineering',
    status: 'applied',
    submittedInDays: 9,
    answers: 'full',
  },
  // Closed 90 days ago, still 'applied', no status change since — #581.
  {
    applicantEmail: 'carol@example.com',
    positionTitle: 'Historian',
    status: 'applied',
    submittedInDays: 91,
    answers: 'full',
  },
];
