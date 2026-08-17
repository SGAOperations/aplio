import { BYPASS_USERS } from '@/lib/bypass-users';

import type { ApplicantDef } from './types';

// Applicants, the three dev-bypass identities, and one deactivated user.
export const applicantDefs: ApplicantDef[] = [
  {
    email: BYPASS_USERS.admin.email,
    name: BYPASS_USERS.admin.name,
    isAdmin: true,
  },
  {
    email: BYPASS_USERS.applicant.email,
    name: BYPASS_USERS.applicant.name,
  },
  {
    email: BYPASS_USERS['position-manager'].email,
    name: BYPASS_USERS['position-manager'].name,
  },
  { email: 'alice@example.com', name: 'Alice Chen' },
  { email: 'bob@example.com', name: 'Bob Martinez' },
  { email: 'carol@example.com', name: 'Carol Johnson' },
  { email: 'david@example.com', name: 'David Kim' },
  { email: 'erin@example.com', name: 'Erin Walsh', deactivated: true },
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
};
