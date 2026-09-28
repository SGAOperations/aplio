import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { orgDayEnd, orgDayStart } from '@/lib/dates';

import {
  type ApplicationStatus,
  type EmailStatus,
  type PositionStatus,
  PrismaClient,
  type User,
} from './client';
import { applicationDefs } from './seed/applications';
import { generateBulkOrientationApplicants } from './seed/bulk';
import { emailLogDefs } from './seed/emails';
import { globalQuestionDefs } from './seed/global-questions';
import {
  defaultStatusTrail,
  minutesAgo,
  orgDayOffset,
  spreadTrailInstants,
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

// Statuses Resend actually saw — a row here has a real sentAt and provider id.
const REACHED_RESEND_STATUSES = new Set<EmailStatus>([
  'sent',
  'delivered',
  'bounced',
  'complained',
  'suppressed',
]);
const SCHEDULED_LIKE_STATUSES = new Set<EmailStatus>([
  'scheduled',
  'cancelled',
]);

const bulk = generateBulkOrientationApplicants();
const allApplicantDefs = [...applicantDefs, ...bulk.applicantDefs];
const allProfileAnswers = { ...profileAnswers, ...bulk.profileAnswers };
const allApplicationDefs = [...applicationDefs, ...bulk.applicationDefs];

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

  function emailLogTimestamps(hoursAgo: number, status: EmailStatus) {
    const createdAt = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
    const sentAt = REACHED_RESEND_STATUSES.has(status)
      ? new Date(createdAt.getTime() + 2_000)
      : null;
    const deliveredAt =
      status === 'delivered' && sentAt
        ? new Date(sentAt.getTime() + 3_000)
        : null;
    const scheduledAt = SCHEDULED_LIKE_STATUSES.has(status)
      ? new Date(createdAt.getTime() + 10_000)
      : null;
    return { createdAt, sentAt, deliveredAt, scheduledAt };
  }

  // Transactional so a partial failure can't leave a DB the guard above would mask.
  // Long timeout: seeding a remote Neon branch has far more round trips than local.
  await prisma.$transaction(
    async (tx) => {
      const admin = await tx.user.create({
        data: { email: SEED_MARKER_EMAIL, name: 'Seed Admin', isAdmin: true },
      });

      // Upsert on email, so a prior bypass login can't collide.
      const applicants: User[] = await Promise.all(
        allApplicantDefs.map((u) => {
          const lastLoginAt =
            u.lastLoginMinutesAgo != null
              ? minutesAgo(now, u.lastLoginMinutesAgo)
              : null;
          return tx.user.upsert({
            where: { email: u.email },
            update: { name: u.name, lastLoginAt },
            create: {
              email: u.email,
              name: u.name,
              isAdmin: u.isAdmin ?? false,
              lastLoginAt,
              createdById: admin.id,
              updatedById: admin.id,
              ...(u.deactivated
                ? { deletedAt: now, deletedById: admin.id }
                : {}),
            },
          });
        }),
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
            include: { questions: true, managers: { select: { id: true } } },
          });
        }),
      );
      const positionsByTitle = Object.fromEntries(
        positions.map((p) => [p.title, p]),
      );

      // Only listed labels get a row, so an omitted question is truly unanswered.
      const globalAnswerData = applicants.flatMap((user) =>
        Object.entries(allProfileAnswers[user.email] ?? {}).map(
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

      const createdApplications = await Promise.all(
        allApplicationDefs.map(async (def) => {
          const user = usersByEmail[def.applicantEmail];
          if (!user)
            throw new Error(`Unknown applicant email: ${def.applicantEmail}`);
          const position = positionsByTitle[def.positionTitle];
          if (!position)
            throw new Error(`Unknown position title: ${def.positionTitle}`);
          if (def.status !== 'draft' && def.submittedInDays === undefined)
            throw new Error(
              `Non-draft application missing submittedInDays: ${def.applicantEmail} / ${def.positionTitle}`,
            );

          // Mirrors createDraftApplication: an incomplete profile copies what exists.
          const globalAnswersData =
            def.answers === 'none'
              ? []
              : Object.entries(allProfileAnswers[user.email] ?? {}).map(
                  ([label, value]) => {
                    const question = globalQuestionsByLabel[label];
                    if (!question)
                      throw new Error(
                        `Unknown global question label: ${label}`,
                      );
                    return {
                      globalQuestionId: question.id,
                      questionLabel: label,
                      questionType: question.type,
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
                    questionType: q.type,
                    value:
                      def.positionAnswerOverrides?.[q.label] ??
                      positionAnswers[position.title]?.[q.label] ??
                      [],
                    createdById: user.id,
                    updatedById: user.id,
                  }))
              : [];

          const application = await tx.application.create({
            data: {
              userId: user.id,
              positionId: position.id,
              status: def.status,
              // Mirrors submitApplication: only a submitted application has a
              // name snapshot; drafts stay null.
              ...(def.status !== 'draft'
                ? { applicantName: def.applicantNameAtSubmit ?? user.name }
                : {}),
              ...(def.submittedInDays !== undefined
                ? { submittedAt: utcDayOffset(now, -def.submittedInDays) }
                : {}),
              createdById: user.id,
              updatedById: user.id,
              globalAnswers: { createMany: { data: globalAnswersData } },
              positionAnswers: { createMany: { data: positionAnswersData } },
            },
          });

          return { application, def, position };
        }),
      );

      const applicationByKey: Record<string, { id: string }> = {};
      for (const { application, def } of createdApplications)
        applicationByKey[`${def.applicantEmail}::${def.positionTitle}`] =
          application;

      // Backfills the audit trail every real write path already produces —
      // 'from' chains from 'draft'; 'applied'/'withdrawn' are applicant
      // moves, everything else is attributed to the position's own manager.
      const statusEventsData: {
        applicationId: string;
        from: ApplicationStatus;
        to: ApplicationStatus;
        changedById: string;
        createdAt: Date;
      }[] = createdApplications
        .filter(({ def }) => def.status !== 'draft')
        .flatMap(({ application, def, position }) => {
          const trail = def.trail ?? defaultStatusTrail(def.status);
          const submittedAt = application.submittedAt;
          if (!submittedAt)
            throw new Error(
              `Non-draft application missing submittedAt: ${def.applicantEmail} / ${def.positionTitle}`,
            );

          // Caps at the close date so an already-archived position (#581)
          // stays archived — every backfilled event stays in the past.
          const end =
            position.closesAt && position.closesAt < now
              ? position.closesAt
              : new Date(now.getTime() - 60 * 60 * 1000);
          const instants = spreadTrailInstants(submittedAt, end, trail.length);
          const managerId = position.managers[0]?.id ?? admin.id;
          const applicantId = usersByEmail[def.applicantEmail]!.id;

          return trail.map((to, idx) => ({
            applicationId: application.id,
            from: idx === 0 ? ('draft' as const) : trail[idx - 1]!,
            to,
            changedById:
              to === 'applied' || to === 'withdrawn' ? applicantId : managerId,
            createdAt: instants[idx]!,
          }));
        });
      await tx.applicationStatusEvent.createMany({ data: statusEventsData });

      // "was opened"/"was closed" activity for every live position — an
      // upcoming position backdates 2 days, one with no opensAt backdates 14.
      const positionStatusEventsData: {
        positionId: string;
        from: PositionStatus;
        to: PositionStatus;
        changedById: string;
        createdAt: Date;
      }[] = positions
        .filter((p) => p.deletedAt === null && p.status !== 'draft')
        .flatMap((p) => {
          const openEventAt =
            p.opensAt && p.opensAt <= now
              ? p.opensAt
              : p.opensAt && p.opensAt > now
                ? new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
                : new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

          const events: {
            positionId: string;
            from: PositionStatus;
            to: PositionStatus;
            changedById: string;
            createdAt: Date;
          }[] = [
            {
              positionId: p.id,
              from: 'draft',
              to: 'open',
              changedById: admin.id,
              createdAt: openEventAt,
            },
          ];
          if (p.status === 'closed')
            events.push({
              positionId: p.id,
              from: 'open',
              to: 'closed',
              changedById: admin.id,
              createdAt: p.closesAt ?? now,
            });
          return events;
        });
      await tx.positionStatusEvent.createMany({
        data: positionStatusEventsData,
      });

      function resolveEmailLogUserId(email: string | undefined): string | null {
        if (!email) return null;
        const user = usersByEmail[email];
        if (!user) throw new Error(`Unknown email-log user email: ${email}`);
        return user.id;
      }

      function resolveEmailLogApplicationId(
        ref: { applicantEmail: string; positionTitle: string } | undefined,
      ): string | null {
        if (!ref) return null;
        const key = `${ref.applicantEmail}::${ref.positionTitle}`;
        const application = applicationByKey[key];
        if (!application)
          throw new Error(`Unknown email-log application: ${key}`);
        return application.id;
      }

      const emailLogData = emailLogDefs.map((def, index) => {
        const { createdAt, sentAt, deliveredAt, scheduledAt } =
          emailLogTimestamps(def.hoursAgo, def.status);
        const reachedResend = REACHED_RESEND_STATUSES.has(def.status);

        return {
          to: def.to,
          userId: resolveEmailLogUserId(def.userEmail),
          applicationId: resolveEmailLogApplicationId(def.application),
          template: def.template,
          subject: def.subject,
          status: def.status,
          providerMessageId: reachedResend ? `seed-${index}` : null,
          scheduledAt,
          sentAt,
          deliveredAt,
          bounceType: def.bounceType ?? null,
          error: def.error ?? null,
          createdAt,
        };
      });
      await tx.emailLog.createMany({ data: emailLogData });
    },
    { timeout: 300_000 },
  );

  const positionsByStatus = positionDefs.reduce<Record<string, number>>(
    (acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1;
      return acc;
    },
    {},
  );
  const applicationsByStatus = allApplicationDefs.reduce<
    Record<string, number>
  >((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});
  const deletedPosition = positionDefs.find((p) => p.deleted);
  const deactivatedUser = allApplicantDefs.find((u) => u.deactivated);

  const lastLoginBuckets = allApplicantDefs.reduce<Record<string, number>>(
    (acc, u) => {
      const bucket =
        u.lastLoginMinutesAgo == null
          ? 'never'
          : u.lastLoginMinutesAgo < 60
            ? 'minutes'
            : u.lastLoginMinutesAgo < 1_440
              ? 'hours'
              : u.lastLoginMinutesAgo < 10_080
                ? 'days'
                : u.lastLoginMinutesAgo < 43_200
                  ? 'weeks'
                  : 'months';
      acc[bucket] = (acc[bucket] ?? 0) + 1;
      return acc;
    },
    {},
  );
  const statusEventCount = allApplicationDefs
    .filter((a) => a.status !== 'draft')
    .reduce(
      (sum, a) => sum + (a.trail ?? defaultStatusTrail(a.status)).length,
      0,
    );
  const positionStatusEventCount = positionDefs
    .filter((p) => !p.deleted && p.status !== 'draft')
    .reduce((sum, p) => sum + (p.status === 'closed' ? 2 : 1), 0);
  const emailLogsByStatus = emailLogDefs.reduce<Record<string, number>>(
    (acc, e) => {
      acc[e.status] = (acc[e.status] ?? 0) + 1;
      return acc;
    },
    {},
  );

  console.log('Seed complete');
  console.log(`Users: ${allApplicantDefs.length + 1} (including seed admin)`);
  console.log('Positions by status:', positionsByStatus);
  console.log('Applications by status:', applicationsByStatus);
  console.log(`Soft-deleted position: ${deletedPosition?.title ?? 'none'}`);
  console.log(`Deactivated user: ${deactivatedUser?.email ?? 'none'}`);
  console.log('Users by last sign-in:', lastLoginBuckets);
  console.log(`Application status events: ${statusEventCount}`);
  console.log(`Position status events: ${positionStatusEventCount}`);
  console.log('Email logs by status:', emailLogsByStatus);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
