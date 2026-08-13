import { BYPASS_USERS } from '@/lib/bypass-users';

import type { ApplicationDef } from './types';

// Every ApplicationStatus is represented at least once. Deliberate edges
// encoded below (see issue #383's plan): a draft a reviewer must never see
// (#349); an accepted application that must refuse withdrawal (#346); a
// withdrawn one that can be re-opened; a manager who is also an applicant on
// a position they manage; an application belonging to a deactivated user; an
// application on a soft-deleted position; a long-closed position whose
// applications are all terminal so it drops out of both 30-day windows;
// submittedAt offsets spanning formatRelativeTime's Nh/Nd/date branches.
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
  // Blocked by the applicant's own incomplete profile, not by this
  // application's answers — exercises the profile-completeness gate on
  // submit rather than the required-question gate.
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
  // Regression fixture for issue #348 — a draft (unsubmitted) application on
  // the same soft-deleted position as the submitted one above; the draft +
  // soft-deleted combination is what the original regression was about, so
  // this must stay invisible everywhere alongside it.
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
  // Long-closed position; this is the only application on it and it is
  // terminal, so the position must drop out of both 30-day admin/manager windows.
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
];
