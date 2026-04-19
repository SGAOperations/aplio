import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './client';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL environment variable is not set');

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

const S = '01970000-0000-7000-8000-000000000001'; // seed user id

async function main() {
  // 1. Seed user
  await prisma.user.upsert({
    where: { id: S },
    update: {},
    create: {
      id: S,
      neonAuthId: '01970000-0000-7000-8000-000000000002',
      email: 'seed@aplio.dev',
      name: 'Seed User',
      isAdmin: true,
    },
  });

  // 2. Global questions
  const gqs = [
    {
      id: '01970000-0000-7000-8000-000000000010',
      order: 1,
      label: 'Full name',
      type: 'short_answer' as const,
      required: true,
      options: [],
    },
    {
      id: '01970000-0000-7000-8000-000000000011',
      order: 2,
      label: 'Year in school',
      type: 'single_choice' as const,
      required: true,
      options: ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'],
    },
    {
      id: '01970000-0000-7000-8000-000000000012',
      order: 3,
      label: 'Major',
      type: 'short_answer' as const,
      required: true,
      options: [],
    },
    {
      id: '01970000-0000-7000-8000-000000000013',
      order: 4,
      label: 'GPA range',
      type: 'single_choice' as const,
      required: true,
      options: ['Below 2.5', '2.5–3.0', '3.0–3.5', '3.5+'],
    },
    {
      id: '01970000-0000-7000-8000-000000000014',
      order: 5,
      label: 'Why do you want to get involved in student government?',
      type: 'long_answer' as const,
      required: true,
      options: [],
    },
    {
      id: '01970000-0000-7000-8000-000000000015',
      order: 6,
      label: 'Relevant experience or leadership roles',
      type: 'long_answer' as const,
      required: true,
      options: [],
    },
    {
      id: '01970000-0000-7000-8000-000000000016',
      order: 7,
      label: 'Areas of interest',
      type: 'multiple_choice' as const,
      required: true,
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
      id: '01970000-0000-7000-8000-000000000017',
      order: 8,
      label: "Anything else you'd like us to know?",
      type: 'long_answer' as const,
      required: false,
      options: [],
    },
  ];
  for (const q of gqs) {
    await prisma.globalQuestion.upsert({
      where: { id: q.id },
      update: {},
      create: { ...q, createdById: S, updatedById: S },
    });
  }

  // 3. Positions + their questions
  const positions = [
    {
      id: '01970000-0000-7000-8000-000000000020',
      title: 'Senator — College of Engineering',
      description:
        'Represent the interests of engineering students in the Student Government Association.',
      questions: [
        {
          id: '01970000-0000-7000-8000-000000000030',
          order: 1,
          label: 'Why do you want to represent the College of Engineering?',
          type: 'long_answer' as const,
          required: true,
          options: [],
        },
        {
          id: '01970000-0000-7000-8000-000000000031',
          order: 2,
          label: 'Describe a time you advocated for a group of people.',
          type: 'long_answer' as const,
          required: true,
          options: [],
        },
        {
          id: '01970000-0000-7000-8000-000000000032',
          order: 3,
          label: 'Are you currently enrolled in the College of Engineering?',
          type: 'single_choice' as const,
          required: true,
          options: ['Yes', 'No'],
        },
      ],
    },
    {
      id: '01970000-0000-7000-8000-000000000021',
      title: 'Director of Finance',
      description:
        'Oversee the SGA budget, manage financial requests, and ensure transparent allocation of student funds.',
      questions: [
        {
          id: '01970000-0000-7000-8000-000000000033',
          order: 1,
          label:
            'Describe your experience with budgeting or financial management.',
          type: 'long_answer' as const,
          required: true,
          options: [],
        },
        {
          id: '01970000-0000-7000-8000-000000000034',
          order: 2,
          label:
            'How would you approach allocating a limited budget across competing student needs?',
          type: 'long_answer' as const,
          required: true,
          options: [],
        },
      ],
    },
    {
      id: '01970000-0000-7000-8000-000000000022',
      title: 'Director of Technology',
      description:
        'Lead digital initiatives for the SGA, maintain the student portal, and improve tech infrastructure.',
      questions: [
        {
          id: '01970000-0000-7000-8000-000000000035',
          order: 1,
          label: 'What technologies are you proficient in?',
          type: 'multiple_choice' as const,
          required: true,
          options: ['JavaScript', 'Python', 'Java', 'SQL', 'Other'],
        },
        {
          id: '01970000-0000-7000-8000-000000000036',
          order: 2,
          label: "Describe a project you've built or contributed to.",
          type: 'long_answer' as const,
          required: true,
          options: [],
        },
        {
          id: '01970000-0000-7000-8000-000000000037',
          order: 3,
          label: 'Are you available for weekly team meetings?',
          type: 'single_choice' as const,
          required: true,
          options: ['Yes', 'No', 'Maybe'],
        },
      ],
    },
    {
      id: '01970000-0000-7000-8000-000000000023',
      title: 'Senator — College of Science',
      description:
        'Voice the concerns and priorities of science students in SGA legislative sessions.',
      questions: [
        {
          id: '01970000-0000-7000-8000-000000000038',
          order: 1,
          label: 'Why do you want to represent the College of Science?',
          type: 'long_answer' as const,
          required: true,
          options: [],
        },
        {
          id: '01970000-0000-7000-8000-000000000039',
          order: 2,
          label: 'What issue in your college would you most like to address?',
          type: 'short_answer' as const,
          required: true,
          options: [],
        },
      ],
    },
    {
      id: '01970000-0000-7000-8000-000000000024',
      title: 'Director of External Relations',
      description:
        'Build partnerships with external organizations, coordinate community outreach, and represent students to university leadership.',
      questions: [
        {
          id: '01970000-0000-7000-8000-000000000040',
          order: 1,
          label:
            'Describe your experience in communications or public relations.',
          type: 'long_answer' as const,
          required: true,
          options: [],
        },
        {
          id: '01970000-0000-7000-8000-000000000041',
          order: 2,
          label: 'How would you build relationships with external partners?',
          type: 'long_answer' as const,
          required: true,
          options: [],
        },
      ],
    },
    {
      id: '01970000-0000-7000-8000-000000000025',
      title: 'Student Advocate',
      description:
        'Serve as a direct point of contact for students with grievances, policy concerns, or unmet needs.',
      questions: [
        {
          id: '01970000-0000-7000-8000-000000000042',
          order: 1,
          label: 'What does student advocacy mean to you?',
          type: 'long_answer' as const,
          required: true,
          options: [],
        },
        {
          id: '01970000-0000-7000-8000-000000000043',
          order: 2,
          label: 'Describe a situation where you helped resolve a conflict.',
          type: 'long_answer' as const,
          required: true,
          options: [],
        },
        {
          id: '01970000-0000-7000-8000-000000000044',
          order: 3,
          label: 'Which student issues are most pressing right now?',
          type: 'multiple_choice' as const,
          required: true,
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

  for (const p of positions) {
    await prisma.position.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        title: p.title,
        description: p.description,
        status: 'open',
        createdById: S,
        updatedById: S,
      },
    });
    for (const q of p.questions) {
      await prisma.positionQuestion.upsert({
        where: { id: q.id },
        update: {},
        create: { ...q, positionId: p.id, createdById: S, updatedById: S },
      });
    }
  }

  console.log('Seed complete');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
