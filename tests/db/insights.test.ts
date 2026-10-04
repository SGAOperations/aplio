import {
  cleanupFixtures,
  createTestApplication,
  createTestGlobalQuestion,
  createTestPosition,
  createTestPositionQuestion,
  createTestUser,
} from '@/tests/helpers/fixtures';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Application, Position, User } from '@/prisma/client';
import {
  getApplicantInsights,
  getAttentionInsights,
  getFunnelInsights,
  getInsightsHistoryStart,
  getPipelineInsights,
  getPositionInsights,
  getQuestionInsights,
  getReviewSpeedInsights,
  getVolumeInsights,
  hasAnySubmittedApplication,
} from '@/prisma/data/insights';

import { orgDayEnd, orgDayStart } from '@/lib/dates';
import { prisma } from '@/lib/prisma';
import type { InsightsRange } from '@/lib/types';

// Isolated in 2001 so these never overlap real dev/seed data — see plan's
// testing section. historyStart resolves to the earliest *real* event
// created below, so every "covered" assertion is relative to that.
const RANGE_2001: InsightsRange = {
  preset: 'custom',
  start: new Date('2001-01-01T00:00:00Z'),
  end: new Date('2001-12-31T23:59:59Z'),
  fromDay: '2001-01-01',
  toDay: '2001-12-31',
  granularity: 'week',
};

const EMPTY_RANGE_1990: InsightsRange = {
  preset: 'custom',
  start: new Date('1990-01-01T00:00:00Z'),
  end: new Date('1990-12-31T23:59:59Z'),
  fromDay: '1990-01-01',
  toDay: '1990-12-31',
  granularity: 'week',
};

let admin: User;
let manager: User;
let position: Position;

// Case: pre-history — submitted before the first real event, only a
// synthetic `from: null` backfill row. Excluded from decision/matrix
// coverage, counted in volume.
let preHistoryApp: Application;

// Case: draft with a misleading submittedAt (must stay null) — excluded
// from volume/heatmap, counted in funnel starts.
let draftApp: Application;

// Case: soft-deleted, with real events — excluded everywhere, matrix included.
let deletedApp: Application;

// Case: reversed decision — accepted -> reviewing is backward.
let reversedApp: Application;

// Case: decision flip — accepted -> rejected shares a rank.
let flipApp: Application;

// Case: resubmission — the decision counted is the one after the *latest* submittedAt.
let resubmitApp: Application;

// Case: org-local day/weekday/hour-block boundary.
let boundaryApp: Application;

beforeAll(async () => {
  admin = await createTestUser({ isAdmin: true });
  manager = await createTestUser();
  position = await createTestPosition(admin, {
    managers: [manager],
    status: 'open',
    opensAt: new Date('2001-01-01T00:00:00Z'),
    closesAt: new Date('2001-12-31T00:00:00Z'),
  });

  await createTestGlobalQuestion(admin, { required: true });
  await createTestPositionQuestion(position, admin, { required: true });

  const preHistoryApplicant = await createTestUser();
  preHistoryApp = await createTestApplication(preHistoryApplicant, position, {
    status: 'accepted',
    createdAt: new Date('2001-01-25T12:00:00Z'),
    submittedAt: new Date('2001-02-01T12:00:00Z'),
  });
  await prisma.applicationStatusEvent.create({
    data: {
      applicationId: preHistoryApp.id,
      from: null,
      to: 'accepted',
      changedById: admin.id,
      createdAt: new Date('2001-02-02T00:00:00Z'),
    },
  });

  const draftApplicant = await createTestUser();
  draftApp = await createTestApplication(draftApplicant, position, {
    status: 'draft',
    createdAt: new Date('2001-03-01T12:00:00Z'),
    updatedAt: new Date('2001-03-01T12:00:00Z'),
    submittedAt: null,
  });

  const deletedApplicant = await createTestUser();
  deletedApp = await createTestApplication(deletedApplicant, position, {
    status: 'accepted',
    createdAt: new Date('2001-03-25T12:00:00Z'),
    submittedAt: new Date('2001-04-01T12:00:00Z'),
    deletedAt: new Date('2001-05-01T00:00:00Z'),
    deletedById: admin.id,
  });
  await prisma.applicationStatusEvent.createMany({
    data: [
      {
        applicationId: deletedApp.id,
        from: 'applied',
        to: 'accepted',
        changedById: manager.id,
        createdAt: new Date('2001-04-02T00:00:00Z'),
      },
    ],
  });

  // The real event history begins here — the earliest `from IS NOT NULL` row.
  const reversedApplicant = await createTestUser();
  reversedApp = await createTestApplication(reversedApplicant, position, {
    status: 'reviewing',
    createdAt: new Date('2001-04-28T12:00:00Z'),
    submittedAt: new Date('2001-05-01T12:00:00Z'),
  });
  await prisma.applicationStatusEvent.createMany({
    data: [
      {
        applicationId: reversedApp.id,
        from: 'applied',
        to: 'accepted',
        changedById: manager.id,
        createdAt: new Date('2001-05-02T00:00:00Z'),
      },
      {
        applicationId: reversedApp.id,
        from: 'accepted',
        to: 'reviewing',
        changedById: manager.id,
        createdAt: new Date('2001-05-03T00:00:00Z'),
      },
    ],
  });

  const flipApplicant = await createTestUser();
  flipApp = await createTestApplication(flipApplicant, position, {
    status: 'rejected',
    createdAt: new Date('2001-05-10T12:00:00Z'),
    submittedAt: new Date('2001-05-11T12:00:00Z'),
  });
  await prisma.applicationStatusEvent.createMany({
    data: [
      {
        applicationId: flipApp.id,
        from: 'applied',
        to: 'accepted',
        changedById: manager.id,
        createdAt: new Date('2001-05-12T00:00:00Z'),
      },
      {
        applicationId: flipApp.id,
        from: 'accepted',
        to: 'rejected',
        changedById: manager.id,
        createdAt: new Date('2001-05-13T00:00:00Z'),
      },
    ],
  });

  const resubmitApplicant = await createTestUser();
  resubmitApp = await createTestApplication(resubmitApplicant, position, {
    status: 'accepted',
    createdAt: new Date('2001-05-30T12:00:00Z'),
    submittedAt: new Date('2001-06-10T00:00:00Z'),
  });
  await prisma.applicationStatusEvent.createMany({
    data: [
      {
        applicationId: resubmitApp.id,
        from: 'draft',
        to: 'applied',
        changedById: resubmitApplicant.id,
        createdAt: new Date('2001-06-01T00:00:00Z'),
      },
      {
        applicationId: resubmitApp.id,
        from: 'applied',
        to: 'rejected',
        changedById: manager.id,
        createdAt: new Date('2001-06-02T00:00:00Z'),
      },
      {
        applicationId: resubmitApp.id,
        from: 'rejected',
        to: 'applied',
        changedById: admin.id,
        createdAt: new Date('2001-06-10T00:00:00Z'),
      },
      {
        applicationId: resubmitApp.id,
        from: 'applied',
        to: 'accepted',
        changedById: manager.id,
        createdAt: new Date('2001-06-12T00:00:00Z'),
      },
    ],
  });

  // America/New_York was on standard time (EST, UTC-5) on this date in
  // 2001 (DST began the first Sunday in April back then) — local
  // 2001-03-09 22:30, a Friday, the 21:00 block.
  const boundaryApplicant = await createTestUser();
  boundaryApp = await createTestApplication(boundaryApplicant, position, {
    status: 'applied',
    createdAt: new Date('2001-03-09T20:00:00Z'),
    submittedAt: new Date('2001-03-10T03:30:00Z'),
  });
});

afterAll(async () => {
  await cleanupFixtures();
});

describe('getInsightsHistoryStart', () => {
  it('resolves to the earliest real (from IS NOT NULL) event', async () => {
    const historyStart = await getInsightsHistoryStart();
    expect(historyStart).not.toBeNull();
    expect(historyStart?.toISOString()).toBe('2001-04-02T00:00:00.000Z');
  });
});

describe('hasAnySubmittedApplication', () => {
  it('is true once at least one submitted application exists', async () => {
    expect(await hasAnySubmittedApplication()).toBe(true);
  });
});

describe('empty range', () => {
  it('every section returns an empty payload without throwing', async () => {
    const [
      volume,
      reviewSpeed,
      pipeline,
      funnel,
      questions,
      applicants,
      positions,
    ] = await Promise.all([
      getVolumeInsights(EMPTY_RANGE_1990),
      getReviewSpeedInsights(EMPTY_RANGE_1990),
      getPipelineInsights(EMPTY_RANGE_1990),
      getFunnelInsights(EMPTY_RANGE_1990),
      getQuestionInsights(EMPTY_RANGE_1990),
      getApplicantInsights(EMPTY_RANGE_1990),
      getPositionInsights(EMPTY_RANGE_1990),
    ]);

    expect(volume.n).toBe(0);
    expect(volume.mostAppliedAll).toEqual([]);
    expect(reviewSpeed.timeToDecision.n).toBe(0);
    expect(reviewSpeed.timeToDecision.medianHours).toBeNull();
    expect(pipeline.transitionMatrix).toEqual([]);
    expect(funnel.conversion).toEqual({ starts: 0, converted: 0, rate: null });
    expect(questions.answerRates.every((r) => r.total === 0)).toBe(true);
    expect(applicants.totalSubmitted).toBe(0);
    expect(applicants.uniqueApplicants).toBe(0);
    expect(positions.zeroApplicationPositions).toEqual([]);
  });
});

describe('getAttentionInsights (not range-bound)', () => {
  let untouchedApp: Application;
  let softDeletedUntouchedApp: Application;

  beforeAll(async () => {
    const untouchedApplicant = await createTestUser();
    untouchedApp = await createTestApplication(untouchedApplicant, position, {
      status: 'applied',
      submittedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    });

    const softDeletedApplicant = await createTestUser();
    softDeletedUntouchedApp = await createTestApplication(
      softDeletedApplicant,
      position,
      {
        status: 'applied',
        submittedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        deletedAt: new Date(),
        deletedById: admin.id,
      },
    );
  });

  it('counts untouched submitted applications and excludes soft-deleted ones', async () => {
    const attention = await getAttentionInsights();
    expect(attention.untouched.count).toBeGreaterThan(0);
    // Aging queue population (status in the unresolved four, submitted,
    // not soft-deleted): reversedApp (reviewing), boundaryApp (applied),
    // untouchedApp (applied). softDeletedUntouchedApp would also qualify by
    // status/submittedAt alone, so its absence here specifically exercises
    // the deletedAt filter, not just the ranking cutoff.
    expect(attention.agingQueue.n).toBe(3);
    const oldestIds = attention.agingQueue.oldest.map((r) => r.applicationId);
    expect(oldestIds).not.toContain(softDeletedUntouchedApp.id);
    expect(untouchedApp.status).toBe('applied');
  });
});

describe('getReviewSpeedInsights (2001 range)', () => {
  it('excludes the pre-history application from decision coverage', async () => {
    const speed = await getReviewSpeedInsights(RANGE_2001);
    expect(speed.timeToDecision.coverage.historyStart?.toISOString()).toBe(
      '2001-04-02T00:00:00.000Z',
    );
    // Covered population starts at historyStart, well after preHistoryApp's
    // submittedAt (2001-02-01) — it can never contribute a decision sample.
    expect(speed.timeToDecision.coverage.coveredCount).toBeLessThan(
      speed.timeToDecision.coverage.totalCount,
    );
  });

  it('uses the decision after the latest submittedAt for a resubmitted application', async () => {
    // Isolated to resubmitApp's own submittedAt (2001-06-10): the earlier
    // 2001-06-02 reject predates it and must not be picked up, so the only
    // possible sample is the 2001-06-12 accept — exactly 48 hours later.
    const juneRange: InsightsRange = {
      ...RANGE_2001,
      start: new Date('2001-06-05T00:00:00Z'),
      end: new Date('2001-06-30T23:59:59Z'),
      fromDay: '2001-06-05',
      toDay: '2001-06-30',
      granularity: 'day',
    };
    const speed = await getReviewSpeedInsights(juneRange);
    expect(speed.timeToDecision.n).toBe(1);
    expect(speed.timeToDecision.medianHours).toBe(48);
  });
});

describe('getPipelineInsights (2001 range)', () => {
  it('excludes the soft-deleted application from the transition matrix', async () => {
    const pipeline = await getPipelineInsights(RANGE_2001);
    const cell = pipeline.transitionMatrix.find(
      (c) => c.from === 'applied' && c.to === 'accepted',
    );
    // reversedApp, flipApp and resubmitApp each contribute one applied ->
    // accepted event; deletedApp's identical event must not add a fourth.
    expect(cell?.count).toBe(3);
  });

  it('classifies accepted -> reviewing as backward and accepted -> rejected as a flip', async () => {
    const pipeline = await getPipelineInsights(RANGE_2001);
    expect(pipeline.backwardCount).toBeGreaterThan(0);
    expect(pipeline.decisionFlipCount).toBeGreaterThan(0);
  });
});

describe('getVolumeInsights (2001 range)', () => {
  it('excludes the draft (null submittedAt) from the series total', async () => {
    const volume = await getVolumeInsights(RANGE_2001);
    const positionIds = volume.mostAppliedAll.map((r) => r.positionId);
    expect(positionIds).toContain(position.id);
    // n counts submitted applications only; the draft never contributes.
    const seriesTotal = volume.series.reduce((s, p) => s + p.count, 0);
    expect(seriesTotal).toBe(volume.n);
  });

  it('buckets the org-local boundary submission onto the correct day', async () => {
    const dayRange: InsightsRange = {
      ...RANGE_2001,
      start: orgDayStart('2001-03-09'),
      end: orgDayEnd('2001-03-09'),
      fromDay: '2001-03-09',
      toDay: '2001-03-09',
      granularity: 'day',
    };
    const volume = await getVolumeInsights(dayRange);
    const dayCount = volume.series.find((p) => p.day === '2001-03-09')?.count;
    expect(dayCount).toBe(1);
    expect(boundaryApp.submittedAt?.toISOString()).toBe(
      '2001-03-10T03:30:00.000Z',
    );

    const cell = volume.heatmap.find((h) => h.weekday === 5 && h.block === 7);
    expect(cell?.count).toBe(1);
  });
});

describe('getFunnelInsights (2001 range)', () => {
  it('counts the draft as a cohort start without counting it as converted', async () => {
    const funnel = await getFunnelInsights(RANGE_2001);
    const positionRow = funnel.conversionByPosition.find(
      (r) => r.positionId === position.id,
    );
    // Cohort (createdAt in 2001, excluding the soft-deleted one): preHistoryApp,
    // draftApp, reversedApp, flipApp, resubmitApp, boundaryApp — draftApp is
    // the only one never submitted.
    expect(positionRow).toMatchObject({ starts: 6, converted: 5 });
    expect(draftApp.status).toBe('draft');
  });
});

describe('getQuestionInsights (choice distribution)', () => {
  let choiceApplicant: User;
  let choiceApp: Application;

  beforeAll(async () => {
    const choiceQuestion = await createTestPositionQuestion(position, admin, {
      type: 'single_choice',
      required: false,
      options: ['Red', 'Blue'],
      allowOther: true,
    });
    choiceApplicant = await createTestUser();
    choiceApp = await createTestApplication(choiceApplicant, position, {
      status: 'applied',
      createdAt: new Date('2001-08-01T00:00:00Z'),
      submittedAt: new Date('2001-08-01T00:00:00Z'),
    });
    await prisma.positionApplicationAnswer.create({
      data: {
        applicationId: choiceApp.id,
        positionQuestionId: choiceQuestion.id,
        questionLabel: choiceQuestion.label,
        questionType: 'single_choice',
        value: ['Green'],
        createdById: choiceApplicant.id,
        updatedById: choiceApplicant.id,
      },
    });
  });

  it('classifies a non-option value as "other" on an allowOther question', async () => {
    const questions = await getQuestionInsights(RANGE_2001);
    const distribution = questions.choiceDistributions.find((q) =>
      q.values.some((v) => v.value === 'Green'),
    );
    expect(distribution?.values.find((v) => v.value === 'Green')?.kind).toBe(
      'other',
    );
    expect(choiceApp.status).toBe('applied');
  });
});

describe('getApplicantInsights (2001 range)', () => {
  it('counts a single applicant with two submitted applications as a repeat applicant', async () => {
    const repeatApplicant = await createTestUser();
    const positionTwo = await createTestPosition(admin, {
      managers: [manager],
      status: 'open',
    });
    await createTestApplication(repeatApplicant, position, {
      status: 'applied',
      createdAt: new Date('2001-09-01T00:00:00Z'),
      submittedAt: new Date('2001-09-01T00:00:00Z'),
    });
    await createTestApplication(repeatApplicant, positionTwo, {
      status: 'applied',
      createdAt: new Date('2001-09-02T00:00:00Z'),
      submittedAt: new Date('2001-09-02T00:00:00Z'),
    });

    const applicants = await getApplicantInsights(RANGE_2001);
    expect(applicants.repeatApplicantCount).toBeGreaterThanOrEqual(1);
  });
});

describe('getPositionInsights (2001 range)', () => {
  it('lists a live position with zero submitted applications in range', async () => {
    const emptyPosition = await createTestPosition(admin, {
      managers: [manager],
      status: 'open',
      opensAt: new Date('2001-02-01T00:00:00Z'),
    });

    const positions = await getPositionInsights(RANGE_2001);
    const ids = positions.zeroApplicationPositions.map((p) => p.positionId);
    expect(ids).toContain(emptyPosition.id);
    expect(ids).not.toContain(position.id);
  });

  it('attributes manager load to every manager of the position', async () => {
    const positions = await getPositionInsights(RANGE_2001);
    const row = positions.managerLoad.find((m) => m.managerId === manager.id);
    expect(row?.submitted).toBeGreaterThan(0);
  });

  it('excludes the caller from their own reviewer throughput (changedById <> userId)', async () => {
    const positions = await getPositionInsights(RANGE_2001);
    // reversedApp's two events were both made by `manager`, never by the applicant.
    const reviewerRow = positions.reviewerThroughput.find(
      (r) => r.reviewerId === manager.id,
    );
    expect(reviewerRow?.eventCount).toBeGreaterThan(0);
  });
});
