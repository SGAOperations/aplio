import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { orgDayEnd, orgDayStart } from '@/lib/dates';

import { PrismaClient, type User } from './client';
import { applicationDefs } from './seed/applications';
import { globalQuestionDefs } from './seed/global-questions';
import {
  orgDayOffset,
  toQuestionCreateInput,
  utcDayOffset,
} from './seed/helpers';
import { positionAnswers, positionDefs } from './seed/positions';
import { applicantDefs, profileAnswers } from './seed/users';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error('DATABASE_URL environment variable is not set');

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

const SEED_MARKER_EMAIL = 'seed@aplio.dev';

async function main() {
  // A bypass login creates its own User row, which would disable a userCount guard.
  const existingSeed = await prisma.user.findUnique({
    where: { email: SEED_MARKER_EMAIL },
  });
  if (existingSeed) {
    console.log('Database already seeded — skipping seed.');
    return;
  }

  const now = new Date();

  // Transactional so a partial failure can't leave a DB the guard above would mask.
  await prisma.$transaction(
    async (tx) => {
      const admin = await tx.user.create({
        data: { email: SEED_MARKER_EMAIL, name: 'Seed Admin', isAdmin: true },
      });

      // Upsert on email, so a prior bypass login can't collide.
      const applicants: User[] = await Promise.all(
        applicantDefs.map((u) =>
          tx.user.upsert({
            where: { email: u.email },
            update: { name: u.name },
            create: {
              email: u.email,
              name: u.name,
              isAdmin: u.isAdmin ?? false,
              createdById: admin.id,
              updatedById: admin.id,
              ...(u.deactivated
                ? { deletedAt: now, deletedById: admin.id }
                : {}),
            },
          }),
        ),
      );

      const usersByEmail: Record<string, User> = Object.fromEntries(
        [admin, ...applicants].map((u) => [u.email, u]),
      );

      const globalQuestions = await tx.globalQuestion.createManyAndReturn({
        data: globalQuestionDefs.map((q) => toQuestionCreateInput(q, admin.id)),
      });
      const globalQuestionsByLabel = Object.fromEntries(
        globalQuestions.map((q) => [q.label, q]),
      );

      const positions = await Promise.all(
        positionDefs.map((p) => {
          const opensAt =
            p.opensInDays != null
              ? orgDayStart(orgDayOffset(now, p.opensInDays))
              : null;
          const closesAt =
            p.closesInDays != null
              ? orgDayEnd(orgDayOffset(now, p.closesInDays))
              : null;
          const managerIds = (p.managerEmails ?? []).map((email) => {
            const manager = usersByEmail[email];
            if (!manager) throw new Error(`Unknown manager email: ${email}`);
            return manager.id;
          });

          return tx.position.create({
            data: {
              title: p.title,
              description: p.description,
              status: p.status,
              opensAt,
              closesAt,
              createdById: admin.id,
              updatedById: admin.id,
              ...(p.deleted ? { deletedAt: now, deletedById: admin.id } : {}),
              ...(managerIds.length > 0
                ? { managers: { connect: managerIds.map((id) => ({ id })) } }
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
          });
        }),
      );
      const positionsByTitle = Object.fromEntries(
        positions.map((p) => [p.title, p]),
      );

      // Only listed labels get a row, so an omitted question is truly unanswered.
      const globalAnswerData = applicants.flatMap((user) =>
        Object.entries(profileAnswers[user.email] ?? {}).map(
          ([label, value]) => {
            const question = globalQuestionsByLabel[label];
            if (!question)
              throw new Error(`Unknown global question label: ${label}`);
            return {
              userId: user.id,
              globalQuestionId: question.id,
              value,
              createdById: user.id,
              updatedById: user.id,
            };
          },
        ),
      );
      await tx.globalAnswer.createMany({
        data: globalAnswerData,
        skipDuplicates: true,
      });

      await Promise.all(
        applicationDefs.map((def) => {
          const user = usersByEmail[def.applicantEmail];
          if (!user)
            throw new Error(`Unknown applicant email: ${def.applicantEmail}`);
          const position = positionsByTitle[def.positionTitle];
          if (!position)
            throw new Error(`Unknown position title: ${def.positionTitle}`);

          // Mirrors createDraftApplication: an incomplete profile copies what exists.
          const globalAnswersData =
            def.answers === 'none'
              ? []
              : Object.entries(profileAnswers[user.email] ?? {}).map(
                  ([label, value]) => {
                    const question = globalQuestionsByLabel[label];
                    if (!question)
                      throw new Error(
                        `Unknown global question label: ${label}`,
                      );
                    return {
                      globalQuestionId: question.id,
                      questionLabel: label,
                      value,
                      createdById: user.id,
                      updatedById: user.id,
                    };
                  },
                );

          // Skipped: fixtures carry no real blob, and all such questions are optional.
          const positionAnswersData =
            def.answers === 'full'
              ? position.questions
                  .filter((q) => q.type !== 'file_upload')
                  .map((q) => ({
                    positionQuestionId: q.id,
                    questionLabel: q.label,
                    value: positionAnswers[position.title]?.[q.label] ?? [],
                    createdById: user.id,
                    updatedById: user.id,
                  }))
              : [];

          return tx.application.create({
            data: {
              userId: user.id,
              positionId: position.id,
              status: def.status,
              // Mirrors submitApplication: only a submitted application has a
              // name snapshot; drafts stay null.
              ...(def.status !== 'draft' ? { applicantName: user.name } : {}),
              ...(def.submittedInDays !== undefined
                ? { submittedAt: utcDayOffset(now, -def.submittedInDays) }
                : {}),
              createdById: user.id,
              updatedById: user.id,
              globalAnswers: { createMany: { data: globalAnswersData } },
              positionAnswers: { createMany: { data: positionAnswersData } },
            },
          });
        }),
      );
    },
    { timeout: 60_000 },
  );

  const positionsByStatus = positionDefs.reduce<Record<string, number>>(
    (acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1;
      return acc;
    },
    {},
  );
  const applicationsByStatus = applicationDefs.reduce<Record<string, number>>(
    (acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1;
      return acc;
    },
    {},
  );
  const deletedPosition = positionDefs.find((p) => p.deleted);
  const deactivatedUser = applicantDefs.find((u) => u.deactivated);

  console.log('Seed complete');
  console.log(`Users: ${applicantDefs.length + 1} (including seed admin)`);
  console.log('Positions by status:', positionsByStatus);
  console.log('Applications by status:', applicationsByStatus);
  console.log(`Soft-deleted position: ${deletedPosition?.title ?? 'none'}`);
  console.log(`Deactivated user: ${deactivatedUser?.email ?? 'none'}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
