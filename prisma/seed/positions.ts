import { BYPASS_USERS } from '@/lib/bypass-users';

import type { PositionDef } from './types';

// Offsets resolve against the seed run's `now`, so every window stays correct.
export const positionDefs: PositionDef[] = [
  {
    title: 'Senator — College of Engineering',
    description:
      'Represent the interests of engineering students in the Student Government Association.',
    status: 'open',
    opensInDays: 0,
    closesInDays: 21,
    managerEmails: [BYPASS_USERS['position-manager'].email],
    questions: [
      {
        order: 1,
        label: 'Why do you want to represent the College of Engineering?',
        type: 'long_answer',
      },
      {
        order: 2,
        label: 'Describe a time you advocated for a group of people.',
        type: 'long_answer',
      },
      {
        order: 3,
        label: 'Are you currently enrolled in the College of Engineering?',
        type: 'single_choice',
        options: ['Yes', 'No'],
      },
    ],
  },
  {
    title: 'Director of Finance',
    description:
      'Oversee the SGA budget, manage financial requests, and ensure transparent allocation of student funds.',
    status: 'open',
    opensInDays: null,
    closesInDays: 0,
    managerEmails: ['david@example.com'],
    questions: [
      {
        order: 1,
        label:
          'Describe your experience with budgeting or financial management.',
        type: 'long_answer',
      },
      {
        order: 2,
        label:
          'How would you approach allocating a limited budget across competing student needs?',
        type: 'long_answer',
      },
    ],
  },
  {
    title: 'Director of Technology',
    description:
      'Lead digital initiatives for the SGA, maintain the student portal, and improve tech infrastructure.',
    status: 'open',
    opensInDays: -7,
    closesInDays: 2,
    questions: [
      {
        order: 1,
        label: 'What technologies are you proficient in?',
        type: 'multiple_choice',
        options: ['JavaScript', 'Python', 'Java', 'SQL'],
        allowOther: true,
      },
      {
        order: 2,
        label: "Describe a project you've built or contributed to.",
        type: 'long_answer',
      },
      {
        order: 3,
        label: 'Are you available for weekly team meetings?',
        type: 'single_choice',
        options: ['Yes', 'No', 'Maybe'],
      },
      {
        order: 4,
        label: 'Optionally upload a resume or writing sample',
        type: 'file_upload',
        required: false,
      },
    ],
  },
  {
    title: 'Senator — College of Science',
    description:
      'Voice the concerns and priorities of science students in SGA legislative sessions.',
    status: 'open',
    opensInDays: 14,
    closesInDays: 45,
    questions: [
      {
        order: 1,
        label: 'Why do you want to represent the College of Science?',
        type: 'long_answer',
      },
      {
        order: 2,
        label: 'What issue in your college would you most like to address?',
        type: 'short_answer',
      },
    ],
  },
  {
    title: 'Director of External Relations',
    description:
      'Build partnerships with external organizations, coordinate community outreach, and represent students to university leadership.',
    status: 'open',
    opensInDays: -30,
    closesInDays: -3,
    questions: [
      {
        order: 1,
        label:
          'Describe your experience in communications or public relations.',
        type: 'long_answer',
      },
      {
        order: 2,
        label: 'How would you build relationships with external partners?',
        type: 'long_answer',
      },
    ],
  },
  {
    title: 'Student Advocate',
    description:
      'Serve as a direct point of contact for students with grievances, policy concerns, or unmet needs.',
    status: 'closed',
    opensInDays: -60,
    closesInDays: -10,
    managerEmails: [BYPASS_USERS['position-manager'].email],
    questions: [
      {
        order: 1,
        label: 'What does student advocacy mean to you?',
        type: 'long_answer',
      },
      {
        order: 2,
        label: 'Describe a situation where you helped resolve a conflict.',
        type: 'long_answer',
      },
      {
        order: 3,
        label: 'Which student issues are most pressing right now?',
        type: 'multiple_choice',
        options: [
          'Housing',
          'Tuition',
          'Mental Health',
          'Dining',
          'Transportation',
          'Campus Safety',
        ],
      },
    ],
  },
  {
    title: 'Chief of Staff',
    description:
      "Coordinate the executive team's daily operations and serve as the President's chief advisor.",
    status: 'draft',
    questions: [],
  },
  {
    title: 'Sustainability Chair',
    description:
      'Lead campus sustainability initiatives and represent environmental priorities within SGA.',
    status: 'closed',
    opensInDays: -120,
    closesInDays: -90,
    questions: [
      {
        order: 1,
        label: 'What sustainability initiative would you prioritize first?',
        type: 'long_answer',
      },
      {
        order: 2,
        label:
          'Describe any experience with environmental advocacy or organizing.',
        type: 'long_answer',
      },
    ],
  },
  {
    title: 'Elections Commissioner',
    description:
      'Administer SGA elections, oversee candidate eligibility, and certify results.',
    status: 'open',
    deleted: true,
    questions: [
      {
        order: 1,
        label: 'Have you previously served on an election oversight committee?',
        type: 'single_choice',
        options: ['Yes', 'No'],
      },
    ],
  },
];

// Per-position answers keyed by question label
export const positionAnswers: Record<string, Record<string, string[]>> = {
  'Senator — College of Engineering': {
    'Why do you want to represent the College of Engineering?': [
      'I want to advocate for better lab funding and computing resources for engineering students.',
    ],
    'Describe a time you advocated for a group of people.': [
      'I lobbied the university to provide free software licenses for all CS students — and succeeded.',
    ],
    'Are you currently enrolled in the College of Engineering?': ['Yes'],
  },
  'Director of Finance': {
    'Describe your experience with budgeting or financial management.': [
      'I managed a $20,000 club budget, reducing unnecessary costs by 15% while expanding programming.',
    ],
    'How would you approach allocating a limited budget across competing student needs?':
      [
        'Survey students, prioritize high-impact items, and publish the full allocation publicly.',
      ],
  },
  'Director of Technology': {
    // 'Rust' isn't an option, so this exercises the virtual "Other" render path.
    'What technologies are you proficient in?': [
      'JavaScript',
      'Python',
      'SQL',
      'Rust',
    ],
    "Describe a project you've built or contributed to.": [
      'Built an open-source room booking system for our CS club, now used by 200+ students weekly.',
    ],
    'Are you available for weekly team meetings?': ['Yes'],
  },
  'Senator — College of Science': {
    'Why do you want to represent the College of Science?': [
      'Science students lack a strong voice in SGA — I want to change that.',
    ],
    'What issue in your college would you most like to address?': [
      'Underfunded undergraduate research stipends.',
    ],
  },
  'Director of External Relations': {
    'Describe your experience in communications or public relations.': [
      'Managed social media for two campus organizations, growing our combined audience by 40%.',
    ],
    'How would you build relationships with external partners?': [
      'Regular outreach, co-hosted events, and transparent communication about student priorities.',
    ],
  },
  'Student Advocate': {
    'What does student advocacy mean to you?': [
      'Turning student frustrations into concrete, actionable policy changes.',
    ],
    'Describe a situation where you helped resolve a conflict.': [
      'I mediated a dispute between housing residents and administration, resulting in a new noise policy.',
    ],
    'Which student issues are most pressing right now?': [
      'Mental Health',
      'Housing',
      'Tuition',
    ],
  },
  'Sustainability Chair': {
    'What sustainability initiative would you prioritize first?': [
      'Expanding campus composting to every dining hall within a semester.',
    ],
    'Describe any experience with environmental advocacy or organizing.': [
      'Organized a campus-wide single-use plastics phase-out petition that gathered 800 signatures.',
    ],
  },
  'Elections Commissioner': {
    'Have you previously served on an election oversight committee?': ['No'],
  },
};
