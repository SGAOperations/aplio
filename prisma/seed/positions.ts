import type { PositionDef } from './types';

export const positionDefs: PositionDef[] = [
  {
    title: 'Senator — College of Engineering',
    description:
      'Represent the interests of engineering students in the Student Government Association.',
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
    questions: [
      {
        order: 1,
        label: 'What technologies are you proficient in?',
        type: 'multiple_choice',
        options: ['JavaScript', 'Python', 'Java', 'SQL', 'Other'],
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
    ],
  },
  {
    title: 'Senator — College of Science',
    description:
      'Voice the concerns and priorities of science students in SGA legislative sessions.',
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
    'What technologies are you proficient in?': ['JavaScript', 'Python', 'SQL'],
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
};
