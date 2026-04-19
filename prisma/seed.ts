import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './client';
import { applicationAssignments } from './seed/applications';
import { globalQuestionDefs } from './seed/global-questions';
import { positionAnswers, positionDefs } from './seed/positions';
import { applicantDefs, profileAnswers } from './seed/users';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error('DATABASE_URL environment variable is not set');

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

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
    data: applicantDefs.map((u) => ({
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
