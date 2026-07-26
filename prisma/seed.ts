import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './client';
import { applicationAssignments } from './seed/applications';
import { globalQuestionDefs } from './seed/global-questions';
import { toQuestionCreateInput } from './seed/helpers';
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

  // Wrapped in a single transaction so a partial failure rolls back instead
  // of leaving a half-seeded DB that the userCount guard above would then
  // mask on every subsequent run. 30s timeout accounts for ~50 sequential
  // writes over one connection against a remote Neon DB.
  await prisma.$transaction(
    async (tx) => {
      // 1. Admin user
      const admin = await tx.user.create({
        data: {
          neonAuthId: crypto.randomUUID(),
          email: 'seed@aplio.dev',
          name: 'Seed Admin',
          isAdmin: true,
        },
      });

      // 2. Applicant users. Created individually (not createManyAndReturn)
      // because Promise.all guarantees its resolved array matches the input
      // array's order — a JS-level guarantee independent of DB insert order —
      // which steps 5 and 6 below rely on to index into profileAnswers.
      const applicants = await Promise.all(
        applicantDefs.map((u) =>
          tx.user.create({
            data: {
              ...u,
              neonAuthId: crypto.randomUUID(),
              createdById: admin.id,
              updatedById: admin.id,
            },
          }),
        ),
      );

      // 3. Global questions
      const globalQuestions = await tx.globalQuestion.createManyAndReturn({
        data: globalQuestionDefs.map((q) => toQuestionCreateInput(q, admin.id)),
      });

      // 4. Positions with their questions
      const positions = await Promise.all(
        positionDefs.map((p) =>
          tx.position.create({
            data: {
              title: p.title,
              description: p.description,
              status: 'open',
              createdById: admin.id,
              updatedById: admin.id,
              questions: {
                createMany: {
                  data: p.questions.map((q) =>
                    toQuestionCreateInput(q, admin.id),
                  ),
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
            tx.globalAnswer.create({
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

            return tx.application.create({
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
    },
    { timeout: 30_000 },
  );

  console.log('Seed complete');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
