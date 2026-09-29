import { BYPASS_USERS } from '@/lib/bypass-users';

import type { PositionDef } from './types';

export const ORIENTATION_LEADER_TITLE = 'Orientation Leader';

// Long enough to check wrapping on position cards and the long-name applicant row.
export const LONG_TITLE_POSITION_TITLE =
  'Senator — College of Social Sciences and Humanities, Representing Undergraduate, Graduate, Transfer and Part-Time Students';

// ~3,000 characters, well under ANSWER_LONG_MAX_LENGTH (5,000).
const LONG_TITLE_POSITION_ANSWER = [
  'Representing this constituency means speaking for students who often fall between the cracks of a single-college senate seat: undergraduates and graduates with different funding structures, transfer students who arrive mid-program without an existing peer network, and part-time students balancing coursework around jobs and family obligations that a typical full-time schedule assumes away.',
  "In my two years on the Social Sciences and Humanities dean's student advisory board, I pushed for evening advising hours, a part-time-friendly add/drop deadline, and a transfer credit appeals process that actually explains its reasoning instead of returning a bare denial. Each of those took multiple semesters of showing up to the same meetings and not letting the issue drop.",
  "I know a seat this broad can't promise every constituency equal attention every semester, so my plan is to run a standing office hour rotated across three formats — in person, video, and async written questions — specifically so transfer and part-time students who can't make a fixed weekly slot still have a real channel in.",
  'If elected, my first action would be publishing a public log of which of these four groups raised which issues each month, so the senate — and my own constituents — can hold me accountable to actually representing all of them, not just whichever group is loudest in a given week.',
].join('\n\n');

// Offsets resolve against the seed run's `now`, so every window stays correct.
export const positionDefs: PositionDef[] = [
  {
    title: 'Senator — College of Engineering',
    description:
      '## About the role\n\nRepresent the interests of engineering students in the Student Government Association.\n\n- Attend weekly SGA sessions\n- Meet with department leadership\n- Champion **student-led** initiatives\n\nQuestions? [Reach out to the SGA office](https://example.com/sga-office).',
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
      'Lead digital initiatives for the SGA, maintain the student portal, and improve tech infrastructure.\n\n1. Ship the new applicant portal\n2. Keep uptime above 99.5%\n3. Mentor a small team of student developers\n\n_Prior experience with Next.js is a plus, but not required._',
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
  // Closed 90 days ago and still holds one unresolved 'applied' application
  // with no status change since — demonstrates #581: this now archives.
  {
    title: 'Historian',
    description:
      'Maintain SGA institutional memory: meeting minutes, records, and the yearly recap.',
    status: 'closed',
    opensInDays: -120,
    closesInDays: -90,
    managerEmails: [BYPASS_USERS['position-manager'].email],
    questions: [
      {
        order: 1,
        label: 'Why does institutional memory matter to student government?',
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
  // Closed_by_date scenario: open, but its deadline has already passed.
  {
    title: 'Director of Academic Affairs',
    description:
      'Advocate for academic policy, course access, and curriculum feedback on behalf of students.',
    status: 'open',
    opensInDays: -45,
    closesInDays: -2,
    questions: [
      {
        order: 1,
        label: 'What academic policy would you most like to change?',
        type: 'long_answer',
      },
      {
        order: 2,
        label: 'Have you served on a curriculum or academic committee before?',
        type: 'single_choice',
        options: ['Yes', 'No'],
      },
    ],
  },
  // Open with no close date — an application here can never become closed_by_date.
  {
    title: 'Director of Student Wellness',
    description:
      'Champion mental health resources, wellness programming, and student support services.',
    status: 'open',
    opensInDays: -5,
    closesInDays: null,
    managerEmails: [BYPASS_USERS['position-manager'].email],
    questions: [
      {
        order: 1,
        label: 'What wellness resource is most missing on campus?',
        type: 'long_answer',
      },
      {
        order: 2,
        label: 'Have you used campus counseling or wellness services?',
        type: 'single_choice',
        options: ['Yes', 'No', 'Prefer not to say'],
      },
    ],
  },
  // Volume scenario: 64 generated applicants, past the 50-row pagination.
  {
    title: ORIENTATION_LEADER_TITLE,
    description:
      'Welcome incoming students to campus and lead orientation sessions throughout the summer.',
    status: 'open',
    opensInDays: -21,
    closesInDays: 9,
    managerEmails: [BYPASS_USERS['position-manager'].email],
    questions: [
      {
        order: 1,
        label: 'Why do you want to be an Orientation Leader?',
        type: 'long_answer',
      },
      {
        order: 2,
        label: 'Which sessions can you staff?',
        type: 'multiple_choice',
        options: ['June', 'July', 'August', 'January'],
      },
      {
        order: 3,
        label: 'Have you been an Orientation Leader before?',
        type: 'single_choice',
        options: ['Yes', 'No'],
      },
    ],
  },
  // Several-managers scenario, plus the long title itself for wrapping checks.
  {
    title: LONG_TITLE_POSITION_TITLE,
    description:
      'Represent undergraduate, graduate, transfer and part-time students across the social sciences and humanities.',
    status: 'open',
    opensInDays: -10,
    closesInDays: 20,
    managerEmails: [
      BYPASS_USERS['position-manager'].email,
      'david@example.com',
      'frank@example.com',
    ],
    questions: [
      {
        order: 1,
        label: 'Why do you want to represent this constituency?',
        type: 'long_answer',
      },
      {
        order: 2,
        label: 'What is your primary campus affiliation?',
        type: 'short_answer',
      },
    ],
  },
  // A manager with nothing to review — this position has zero applications.
  {
    title: 'Parliamentarian',
    description: '',
    status: 'open',
    opensInDays: -3,
    closesInDays: 14,
    managerEmails: ['grace@example.com'],
    questions: [
      {
        order: 1,
        label: "Are you familiar with Robert's Rules of Order?",
        type: 'single_choice',
        options: ['Yes', 'No'],
      },
    ],
  },
  // Draft, so it appears in the PM's draft group alongside their own draft application.
  {
    title: 'Director of Communications',
    description:
      'Manage SGA public communications, social media, and campus-wide announcements.',
    status: 'draft',
    managerEmails: [BYPASS_USERS['position-manager'].email],
    questions: [],
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
  Historian: {
    'Why does institutional memory matter to student government?': [
      'Every new session re-litigates decisions the last one already made — good records stop that.',
    ],
  },
  'Director of Academic Affairs': {
    'What academic policy would you most like to change?': [
      'Standardize a syllabus-change notice period so students can plan around it.',
    ],
    'Have you served on a curriculum or academic committee before?': ['No'],
  },
  'Director of Student Wellness': {
    'What wellness resource is most missing on campus?': [
      'Same-week counseling appointments during midterms and finals.',
    ],
    'Have you used campus counseling or wellness services?': ['Yes'],
  },
  [ORIENTATION_LEADER_TITLE]: {
    'Why do you want to be an Orientation Leader?': [
      'I remember how lost I felt as a new student, and I want to be the person who makes that easier for the next class.',
    ],
    'Which sessions can you staff?': ['June', 'July'],
    'Have you been an Orientation Leader before?': ['No'],
  },
  [LONG_TITLE_POSITION_TITLE]: {
    'Why do you want to represent this constituency?': [
      LONG_TITLE_POSITION_ANSWER,
    ],
    'What is your primary campus affiliation?': [
      'College of Social Sciences and Humanities',
    ],
  },
  Parliamentarian: {
    "Are you familiar with Robert's Rules of Order?": ['Yes'],
  },
};
