import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './client';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error('DATABASE_URL environment variable is not set');

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

type QType =
  | 'short_answer'
  | 'long_answer'
  | 'single_choice'
  | 'multiple_choice';

interface QuestionDef {
  order: number;
  label: string;
  type: QType;
  required?: boolean;
  options?: string[];
}

interface PositionDef {
  title: string;
  description: string;
  questions: QuestionDef[];
}

const globalQuestionDefs: QuestionDef[] = [
  { order: 1, label: 'Full name', type: 'short_answer' },
  {
    order: 2,
    label: 'Year in school',
    type: 'single_choice',
    options: ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'],
  },
  { order: 3, label: 'Major', type: 'short_answer' },
  {
    order: 4,
    label: 'GPA range',
    type: 'single_choice',
    options: ['Below 2.5', '2.5–3.0', '3.0–3.5', '3.5+'],
  },
  {
    order: 5,
    label: 'Why do you want to get involved in student government?',
    type: 'long_answer',
  },
  {
    order: 6,
    label: 'Relevant experience or leadership roles',
    type: 'long_answer',
  },
  {
    order: 7,
    label: 'Areas of interest',
    type: 'multiple_choice',
    options: [
      'Academic Affairs',
      'Student Life',
      'Diversity & Inclusion',
      'Finance',
      'External Relations',
      'Technology',
    ],
  },
  {
    order: 8,
    label: "Anything else you'd like us to know?",
    type: 'long_answer',
    required: false,
  },
];

const positionDefs: PositionDef[] = [
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

// Per-applicant profile answers keyed by question label
const profileAnswers: Record<string, string[]>[] = [
  {
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
  {
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
  {
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
  {
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
];

// Per-position answers keyed by question label
const positionAnswers: Record<string, Record<string, string[]>> = {
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

// Which positions each applicant applies to (by index into positionDefs)
const applicationAssignments = [
  { applicantIdx: 0, positionIndices: [0, 2] }, // Alice: Engineering Senator, Director of Tech
  { applicantIdx: 1, positionIndices: [1, 4] }, // Bob: Director of Finance, External Relations
  { applicantIdx: 2, positionIndices: [3, 5] }, // Carol: Science Senator, Student Advocate
  { applicantIdx: 3, positionIndices: [4, 5] }, // David: External Relations, Student Advocate
];

async function main() {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log('Database already has users — skipping seed.');
    return;
  }

  // 1. Admin user
  const admin = await prisma.user.create({
    data: {
      neonAuthId: crypto.randomUUID(),
      email: 'seed@aplio.dev',
      name: 'Seed Admin',
      isAdmin: true,
    },
  });

  // 2. Applicant users
  const applicants = await prisma.user.createManyAndReturn({
    data: [
      { email: 'alice@example.com', name: 'Alice Chen' },
      { email: 'bob@example.com', name: 'Bob Martinez' },
      { email: 'carol@example.com', name: 'Carol Johnson' },
      { email: 'david@example.com', name: 'David Kim' },
    ].map((u) => ({
      ...u,
      neonAuthId: crypto.randomUUID(),
      createdById: admin.id,
      updatedById: admin.id,
    })),
  });

  // 3. Global questions
  const globalQuestions = await prisma.globalQuestion.createManyAndReturn({
    data: globalQuestionDefs.map((q) => ({
      ...q,
      required: q.required ?? true,
      options: q.options ?? [],
      createdById: admin.id,
      updatedById: admin.id,
    })),
  });

  // 4. Positions with their questions
  const positions = await Promise.all(
    positionDefs.map((p) =>
      prisma.position.create({
        data: {
          title: p.title,
          description: p.description,
          status: 'open',
          createdById: admin.id,
          updatedById: admin.id,
          questions: {
            createMany: {
              data: p.questions.map((q) => ({
                ...q,
                required: q.required ?? true,
                options: q.options ?? [],
                createdById: admin.id,
                updatedById: admin.id,
              })),
            },
          },
        },
        include: { questions: true },
      }),
    ),
  );

  // 5. Global answers (saved profile answers) for each applicant
  await Promise.all(
    applicants.flatMap((applicant, i) =>
      globalQuestions.map((q) =>
        prisma.globalAnswer.create({
          data: {
            userId: applicant.id,
            globalQuestionId: q.id,
            value: profileAnswers[i][q.label] ?? [],
            createdById: applicant.id,
            updatedById: applicant.id,
          },
        }),
      ),
    ),
  );

  // 6. Applications with global and position answers
  await Promise.all(
    applicationAssignments.flatMap(({ applicantIdx, positionIndices }) =>
      positionIndices.map((positionIdx) => {
        const applicant = applicants[applicantIdx];
        const position = positions[positionIdx];

        return prisma.application.create({
          data: {
            userId: applicant.id,
            positionId: position.id,
            status: 'applied',
            createdById: applicant.id,
            updatedById: applicant.id,
            globalAnswers: {
              createMany: {
                data: globalQuestions.map((q) => ({
                  globalQuestionId: q.id,
                  questionLabel: q.label,
                  value: profileAnswers[applicantIdx][q.label] ?? [],
                  createdById: applicant.id,
                  updatedById: applicant.id,
                })),
              },
            },
            positionAnswers: {
              createMany: {
                data: position.questions.map((q) => ({
                  positionQuestionId: q.id,
                  questionLabel: q.label,
                  value: positionAnswers[position.title]?.[q.label] ?? [],
                  createdById: applicant.id,
                  updatedById: applicant.id,
                })),
              },
            },
          },
        });
      }),
    ),
  );

  console.log('Seed complete');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
