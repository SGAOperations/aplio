import { BYPASS_USERS } from '@/lib/bypass-users';

import type { ApplicantDef } from './types';

const MINUTE = 1;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

// Long name and long email, for wrapping/truncation checks.
export const LONG_NAME_APPLICANT_EMAIL =
  'maximiliana.alexandra.konstantinopoulou-vanderbilt@example.com';

// No real blob backs this — getFileDisplayName renders the last path segment,
// so a placeholder still exercises the file-answer UI end to end.
export function resumeUrl(slug: string): string {
  return `https://seed-placeholder.public.blob.vercel-storage.com/answers/profile/seed/${slug}-resume.pdf`;
}

// ~1,500 characters, for wrapping/truncation checks on the global profile answer.
const LONG_EXPERIENCE_ANSWER = [
  'I have spent the last three years building cross-college coalitions on campus, starting as a first-year representative for International Relations and growing into a role that regularly brings together student leaders from Engineering, Business, the Arts, and the Sciences around shared advocacy goals.',
  'As co-chair of the Comparative Literature Society, I organized a semester-long speaker series that drew over four hundred attendees across six events, secured co-sponsorship from three unrelated departments, and negotiated a recurring line item in the department budget so the series would outlast my own graduation.',
  'Outside formal leadership roles, I have translated policy documents for the international student office, mediated two separate housing disputes between residents from different cultural backgrounds, and mentored incoming students navigating visa and enrollment processes for the first time.',
  'I want to bring that same coalition-building instinct to student government: representing my own constituency well, but also making sure students who are easy to overlook — transfer students, part-time students, students juggling jobs alongside coursework — have a real seat at the table.',
].join('\n\n');

// Applicants, the three dev-bypass identities, and one deactivated user.
// lastLoginMinutesAgo spans minutes/hours/days/weeks/months; an omitted
// value models "never signed in" for the Users page's "—" and nulls-last sort.
export const applicantDefs: ApplicantDef[] = [
  {
    email: BYPASS_USERS.admin.email,
    name: BYPASS_USERS.admin.name,
    isAdmin: true,
    lastLoginMinutesAgo: 5 * MINUTE,
  },
  {
    email: BYPASS_USERS.applicant.email,
    name: BYPASS_USERS.applicant.name,
    lastLoginMinutesAgo: 2 * HOUR,
  },
  {
    email: BYPASS_USERS['position-manager'].email,
    name: BYPASS_USERS['position-manager'].name,
    lastLoginMinutesAgo: 1 * DAY,
  },
  {
    email: 'alice@example.com',
    name: 'Alice Chen',
    lastLoginMinutesAgo: 3 * DAY,
  },
  {
    email: 'bob@example.com',
    name: 'Bob Martinez',
    lastLoginMinutesAgo: 2 * WEEK,
  },
  {
    email: 'carol@example.com',
    name: 'Carol Johnson',
    lastLoginMinutesAgo: 5 * WEEK,
  },
  {
    email: 'david@example.com',
    name: 'David Kim',
    lastLoginMinutesAgo: 4 * MONTH,
  },
  {
    email: 'erin@example.com',
    name: 'Erin Walsh',
    deactivated: true,
    lastLoginMinutesAgo: 6 * MONTH,
  },
  // Reached_out on Engineering by a withdraw-and-resubmit trail.
  {
    email: 'frank@example.com',
    name: 'Frank Osei',
    lastLoginMinutesAgo: 20 * MINUTE,
  },
  // Zero profile answers — see profileAnswers below.
  {
    email: 'priya@example.com',
    name: 'Priya Raman',
    lastLoginMinutesAgo: 1 * HOUR,
  },
  {
    email: 'hana@example.com',
    name: 'Hana Suzuki',
    lastLoginMinutesAgo: 4 * DAY,
  },
  {
    email: 'ivan@example.com',
    name: 'Ivan Petrov',
    lastLoginMinutesAgo: 3 * WEEK,
  },
  // Rejected on Engineering; never signs in.
  { email: 'julia@example.com', name: 'Julia Novak' },
  {
    email: 'kofi@example.com',
    name: 'Kofi Mensah',
    lastLoginMinutesAgo: 2 * MONTH,
  },
  // Manages Parliamentarian, which has no applications — never signs in.
  { email: 'grace@example.com', name: 'Grace Liu' },
  // The name gate: a null name and no bypass identity to sign in through.
  { email: 'no-name@example.com', name: null },
  {
    email: LONG_NAME_APPLICANT_EMAIL,
    name: 'Maximiliana Alexandra Konstantinopoulou-Vanderbilt',
    lastLoginMinutesAgo: 6 * HOUR,
  },
];

// An omitted label models "never answered", not "answered blank".
export const profileAnswers: Record<string, Record<string, string[]>> = {
  [BYPASS_USERS.admin.email]: {
    'Full name': [BYPASS_USERS.admin.name],
    'Year in school': ['Graduate'],
    Major: ['Computer Science'],
    'GPA range': ['3.5+'],
    'Why do you want to get involved in student government?': [
      'I exercise every admin workflow end-to-end from this account.',
    ],
    'Relevant experience or leadership roles': [
      'Runs the platform in dev bypass mode daily.',
    ],
    'Areas of interest': ['Technology'],
    "Anything else you'd like us to know?": [],
  },
  [BYPASS_USERS.applicant.email]: {
    'Full name': [BYPASS_USERS.applicant.name],
    'Year in school': ['Junior'],
    Major: ['Political Science'],
    'GPA range': ['3.0–3.5'],
    'Why do you want to get involved in student government?': [
      'I want to see every stage of the application lifecycle from one account.',
    ],
    'Relevant experience or leadership roles': [
      'Class representative for two years.',
    ],
    'Areas of interest': ['Student Life', 'Academic Affairs'],
    "Anything else you'd like us to know?": [
      'This account carries the full application state matrix.',
    ],
    Resume: [resumeUrl('bypass-applicant')],
  },
  [BYPASS_USERS['position-manager'].email]: {
    'Full name': [BYPASS_USERS['position-manager'].name],
    Major: ['Business Administration'],
    'GPA range': ['3.0–3.5'],
    'Why do you want to get involved in student government?': [
      'I manage positions and also apply to one, to exercise both roles.',
    ],
    'Relevant experience or leadership roles': [
      'Manages Engineering and Student Advocate.',
    ],
    "Anything else you'd like us to know?": [],
  },
  'alice@example.com': {
    'Full name': ['Alice Chen'],
    'Year in school': ['Junior'],
    Major: ['Computer Science'],
    'GPA range': ['3.5+'],
    'Why do you want to get involved in student government?': [
      'I want to improve campus tech resources and make university processes more accessible to students.',
    ],
    'Relevant experience or leadership roles': [
      'CS Club President for two years — led a team of 12 building an open-source campus tool.',
    ],
    'Areas of interest': ['Technology', 'Academic Affairs'],
    "Anything else you'd like us to know?": ['Fluent in Mandarin and Spanish.'],
    Resume: [resumeUrl('alice-chen')],
  },
  'bob@example.com': {
    'Full name': ['Bob Martinez'],
    'Year in school': ['Senior'],
    Major: ['Finance'],
    'GPA range': ['3.0–3.5'],
    'Why do you want to get involved in student government?': [
      'I want to ensure student funds are allocated transparently and equitably.',
    ],
    'Relevant experience or leadership roles': [
      'Treasurer of the Business Society for two semesters, managing a $15,000 annual budget.',
    ],
    'Areas of interest': ['Finance', 'External Relations'],
    "Anything else you'd like us to know?": [],
  },
  'carol@example.com': {
    'Full name': ['Carol Johnson'],
    'Year in school': ['Sophomore'],
    Major: ['Biology'],
    'GPA range': ['3.5+'],
    'Why do you want to get involved in student government?': [
      'Science students are underrepresented in SGA and I want to change that.',
    ],
    'Relevant experience or leadership roles': [
      'Undergraduate research assistant in the Microbiology department for one year.',
    ],
    'Areas of interest': ['Academic Affairs', 'Diversity & Inclusion'],
    "Anything else you'd like us to know?": [
      'First-generation college student.',
    ],
  },
  'david@example.com': {
    'Full name': ['David Kim'],
    'Year in school': ['Graduate'],
    Major: ['Public Policy'],
    'GPA range': ['3.5+'],
    'Why do you want to get involved in student government?': [
      'I am passionate about translating student grievances into real policy changes.',
    ],
    'Relevant experience or leadership roles': [
      'Graduate student representative on the Faculty Senate for one academic year.',
    ],
    'Areas of interest': [
      'Student Life',
      'Diversity & Inclusion',
      'External Relations',
    ],
    "Anything else you'd like us to know?": [
      'Available for extended office hours.',
    ],
    Resume: [resumeUrl('david-kim')],
  },
  'erin@example.com': {
    'Full name': ['Erin Walsh'],
    'Year in school': ['Senior'],
    Major: ['Environmental Science'],
    'GPA range': ['3.0–3.5'],
    'Why do you want to get involved in student government?': [
      'I want a voice for students even though my account has since been deactivated.',
    ],
    'Relevant experience or leadership roles': [
      'Sustainability Club officer for one year.',
    ],
    'Areas of interest': ['Academic Affairs'],
    "Anything else you'd like us to know?": [],
  },
  'frank@example.com': {
    'Full name': ['Frank Osei'],
    'Year in school': ['Senior'],
    Major: ['Mechanical Engineering'],
    'GPA range': ['3.0–3.5'],
    'Why do you want to get involved in student government?': [
      'I withdrew once and came back — I want to see this through.',
    ],
    'Relevant experience or leadership roles': [
      'Engineering Student Council secretary for one year.',
    ],
    'Areas of interest': ['Academic Affairs', 'Technology'],
    "Anything else you'd like us to know?": [],
  },
  'hana@example.com': {
    'Full name': ['Hana Suzuki'],
    'Year in school': ['Junior'],
    Major: ['Electrical Engineering'],
    'GPA range': ['3.5+'],
    'Why do you want to get involved in student government?': [
      'Engineering students need a louder voice in campus resource decisions.',
    ],
    'Relevant experience or leadership roles': [
      'IEEE student chapter officer for two years.',
    ],
    'Areas of interest': ['Technology'],
    "Anything else you'd like us to know?": [],
  },
  'ivan@example.com': {
    'Full name': ['Ivan Petrov'],
    'Year in school': ['Graduate'],
    Major: ['Computer Engineering'],
    'GPA range': ['3.5+'],
    'Why do you want to get involved in student government?': [
      'I want to bring a graduate perspective to engineering advocacy.',
    ],
    'Relevant experience or leadership roles': [
      'Teaching assistant and graduate senator alternate for one year.',
    ],
    'Areas of interest': ['Technology', 'Academic Affairs'],
    "Anything else you'd like us to know?": [],
    Resume: [resumeUrl('ivan-petrov')],
  },
  'julia@example.com': {
    'Full name': ['Julia Novak'],
    'Year in school': ['Sophomore'],
    Major: ['Materials Science'],
    'GPA range': ['3.0–3.5'],
    'Why do you want to get involved in student government?': [
      'I want more transparency around how engineering fees are spent.',
    ],
    'Relevant experience or leadership roles': [
      'Volunteer coordinator for a campus makerspace.',
    ],
    'Areas of interest': ['Academic Affairs'],
    "Anything else you'd like us to know?": [],
  },
  'kofi@example.com': {
    'Full name': ['Kofi Mensah'],
    'Year in school': ['Senior'],
    Major: ['Civil Engineering'],
    'GPA range': ['2.5–3.0'],
    'Why do you want to get involved in student government?': [
      'I withdrew this term but want to run again once my schedule clears.',
    ],
    'Relevant experience or leadership roles': [
      'Intramural sports club treasurer for one year.',
    ],
    'Areas of interest': ['Student Life'],
    "Anything else you'd like us to know?": [],
  },
  'grace@example.com': {
    'Full name': ['Grace Liu'],
    'Year in school': ['Graduate'],
    Major: ['Public Administration'],
    'GPA range': ['3.5+'],
    'Why do you want to get involved in student government?': [
      'I manage Parliamentarian and keep our procedures running smoothly.',
    ],
    'Relevant experience or leadership roles': [
      'Parliamentarian for a graduate student association chapter.',
    ],
    "Anything else you'd like us to know?": [],
  },
  'no-name@example.com': {
    'Year in school': ['Freshman'],
    Major: ['Undeclared'],
    'GPA range': ['3.0–3.5'],
    'Why do you want to get involved in student government?': [
      "I'm still setting up my account.",
    ],
    'Relevant experience or leadership roles': [],
    "Anything else you'd like us to know?": [],
  },
  [LONG_NAME_APPLICANT_EMAIL]: {
    'Full name': ['Maximiliana Alexandra Konstantinopoulou-Vanderbilt'],
    'Year in school': ['Junior'],
    Major: ['International Relations and Comparative Literature'],
    'GPA range': ['3.5+'],
    'Why do you want to get involved in student government?': [
      'I want to represent students across every college, not just my own.',
    ],
    'Relevant experience or leadership roles': [LONG_EXPERIENCE_ANSWER],
    'Areas of interest': [
      'Student Life',
      'Diversity & Inclusion',
      'External Relations',
    ],
    "Anything else you'd like us to know?": [],
  },
};
