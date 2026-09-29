import { BYPASS_USERS } from '@/lib/bypass-users';

import { LONG_TITLE_POSITION_TITLE } from './positions';
import type { ApplicationDef } from './types';
import { LONG_NAME_APPLICANT_EMAIL } from './users';

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
  // Snapshot differs from Bob's current name — the renamed-applicant scenario.
  {
    applicantEmail: 'bob@example.com',
    positionTitle: 'Student Advocate',
    status: 'interview_scheduled',
    submittedInDays: 40,
    answers: 'full',
    applicantNameAtSubmit: 'Robert Martinez',
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
  // closed_by_date: the position is open but its deadline already passed.
  {
    applicantEmail: BYPASS_USERS.applicant.email,
    positionTitle: 'Director of Academic Affairs',
    status: 'draft',
    answers: 'partial',
  },
  // Withdrawn on an open position with no close date — Edit & resubmit stays enabled.
  {
    applicantEmail: BYPASS_USERS.applicant.email,
    positionTitle: 'Director of Student Wellness',
    status: 'withdrawn',
    submittedInDays: 10,
    answers: 'full',
  },
  // The PM's own draft, on a position that hasn't opened yet.
  {
    applicantEmail: BYPASS_USERS['position-manager'].email,
    positionTitle: 'Senator — College of Science',
    status: 'draft',
    answers: 'partial',
  },
  // Withdraw-and-resubmit trail, so one history panel shows the round trip.
  {
    applicantEmail: 'frank@example.com',
    positionTitle: 'Senator — College of Engineering',
    status: 'reached_out',
    submittedInDays: 5,
    answers: 'full',
    trail: ['applied', 'withdrawn', 'applied', 'reached_out'],
  },
  {
    applicantEmail: 'hana@example.com',
    positionTitle: 'Senator — College of Engineering',
    status: 'reviewing',
    submittedInDays: 12,
    answers: 'full',
  },
  {
    applicantEmail: 'ivan@example.com',
    positionTitle: 'Senator — College of Engineering',
    status: 'accepted',
    submittedInDays: 25,
    answers: 'full',
  },
  {
    applicantEmail: 'julia@example.com',
    positionTitle: 'Senator — College of Engineering',
    status: 'rejected',
    submittedInDays: 15,
    answers: 'full',
  },
  {
    applicantEmail: 'kofi@example.com',
    positionTitle: 'Senator — College of Engineering',
    status: 'withdrawn',
    submittedInDays: 18,
    answers: 'full',
  },
  // Shown by email on the Engineering queue — the name-gate scenario.
  {
    applicantEmail: 'no-name@example.com',
    positionTitle: 'Senator — College of Engineering',
    status: 'draft',
    answers: 'partial',
  },
  // Zero profile answers — the applicant's profile carries none to copy.
  {
    applicantEmail: 'priya@example.com',
    positionTitle: 'Director of Student Wellness',
    status: 'draft',
    answers: 'none',
  },
  // Long name, long title, long answers — wrapping/truncation checks.
  {
    applicantEmail: LONG_NAME_APPLICANT_EMAIL,
    positionTitle: LONG_TITLE_POSITION_TITLE,
    status: 'applied',
    submittedInDays: 2,
    answers: 'full',
  },
];
