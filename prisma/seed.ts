import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './client';
import {
  applicationAssignments,
  draftApplicationAssignments,
} from './seed/applications';
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

  // Transactional so a partial failure rolls back instead of leaving a
  // half-seeded DB that the userCount guard above would mask on rerun.
  // 30s timeout: ~50 sequential writes over one connection to a remote Neon DB.
  await prisma.$transaction(
    async (tx) => {
      const admin = await tx.user.create({
        data: {
          neonAuthId: crypto.randomUUID(),
          email: 'seed@aplio.dev',
          name: 'Seed Admin',
          isAdmin: true,
        },
      });

      // Created individually rather than createManyAndReturn: Promise.all's
      // resolved array matches applicantDefs' order regardless of DB insert
      // order, which the code below relies on to index into profileAnswers.
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

      const globalQuestions = await tx.globalQuestion.createManyAndReturn({
        data: globalQuestionDefs.map((q) => toQuestionCreateInput(q, admin.id)),
      });

      const positions = await Promise.all(
        positionDefs.map((p) =>
          tx.position.create({
            data: {
              title: p.title,
              description: p.description,
              status: p.status ?? 'open',
              createdById: admin.id,
              updatedById: admin.id,
              // Regression fixture for issue #348 — soft-deleted, so every
              // cross-position surface must exclude its applications.
              ...(p.deleted
                ? { deletedAt: new Date(), deletedById: admin.id }
                : {}),
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

      // Regression fixture for issue #348 — a draft (unsubmitted) application
      // against the soft-deleted position, alongside the submitted one above.
      await Promise.all(
        draftApplicationAssignments.map(({ applicantIdx, positionIdx }) => {
          const applicant = applicants[applicantIdx];
          const position = positions[positionIdx];

          return tx.application.create({
            data: {
              userId: applicant.id,
              positionId: position.id,
              status: 'draft',
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
            },
          });
        }),
      );
    },
    { timeout: 30_000 },
  );

  console.log('Seed complete');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
