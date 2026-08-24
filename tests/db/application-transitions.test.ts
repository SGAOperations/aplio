import {
  answerAllRequiredGlobalQuestions,
  cleanupFixtures,
  createTestApplication,
  createTestGlobalQuestion,
  createTestPosition,
  createTestPositionQuestion,
  createTestUser,
} from '@/tests/helpers/fixtures';
import { actAs } from '@/tests/stubs/auth-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createOrUpdateApplicationAnswer,
  deleteDraftApplication,
  submitApplication,
  updateApplicationStatus,
  updateApplicationStatuses,
  withdrawApplication,
} from '@/prisma/actions/applications';
import type { $Enums, GlobalQuestion, Position, User } from '@/prisma/client';
import { getApplicationStatusHistory } from '@/prisma/data/applications';

import {
  APPLICANT_EDITABLE_APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_VALUES,
  NON_REVIEWABLE_APPLICATION_STATUSES,
  REVIEWER_APPLICATION_STATUSES,
  isAllowedApplicationStatusTransition,
} from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { isError } from '@/lib/utils';

// Mirrors the (deliberately unexported) copy in prisma/actions/applications.ts —
// asserting the exact sentence is the point of this suite.
const APPLICATION_NOT_EDITABLE_MESSAGE =
  'This application has already been submitted. Withdraw it to make changes.';
const WITHDRAW_NOT_ALLOWED_MESSAGE =
  'This application can no longer be withdrawn.';
const DRAFT_DELETE_NOT_ALLOWED_MESSAGE = 'This draft can no longer be deleted.';
const POSITION_NOT_ACCEPTING_MESSAGE =
  'This position is no longer accepting applications.';
const MISSING_POSITION_ANSWERS_MESSAGE =
  'Please answer all required questions before submitting.';

const ALL_STATUSES: $Enums.ApplicationStatus[] = [
  ...APPLICATION_STATUS_VALUES,
  'withdrawn',
];

let admin: User;
let openPosition: Position;
let globalQuestion: GlobalQuestion;

beforeAll(async () => {
  admin = await createTestUser({ isAdmin: true });
  openPosition = await createTestPosition(admin);
  globalQuestion = await createTestGlobalQuestion(admin, { required: false });
});

afterAll(async () => {
  await cleanupFixtures();
});

describe('submitApplication', () => {
  for (const status of ALL_STATUSES) {
    const isLegal = (
      APPLICANT_EDITABLE_APPLICATION_STATUSES as readonly string[]
    ).includes(status);

    it(`${isLegal ? 'allows' : 'blocks'} submit from ${status}`, async () => {
      const applicant = await createTestUser();
      const application = await createTestApplication(applicant, openPosition, {
        status,
      });
      await answerAllRequiredGlobalQuestions(applicant);

      actAs(applicant);
      const result = await submitApplication(application.id);

      if (isLegal) expect(result).toBeUndefined();
      else expect(result).toEqual({ error: APPLICATION_NOT_EDITABLE_MESSAGE });
    });
  }
});

describe('createOrUpdateApplicationAnswer', () => {
  for (const status of ALL_STATUSES) {
    const isLegal = (
      APPLICANT_EDITABLE_APPLICATION_STATUSES as readonly string[]
    ).includes(status);

    it(`${isLegal ? 'allows' : 'blocks'} answering from ${status}`, async () => {
      const applicant = await createTestUser();
      const application = await createTestApplication(applicant, openPosition, {
        status,
      });

      actAs(applicant);
      const result = await createOrUpdateApplicationAnswer({
        applicationId: application.id,
        questionId: globalQuestion.id,
        value: ['hello'],
      });

      if (isLegal) expect(isError(result)).toBe(false);
      else expect(result).toEqual({ error: APPLICATION_NOT_EDITABLE_MESSAGE });
    });
  }
});

describe('withdrawApplication', () => {
  const LEGAL_STATUSES: $Enums.ApplicationStatus[] = [
    'applied',
    'reached_out',
    'interview_scheduled',
    'reviewing',
  ];

  for (const status of ALL_STATUSES) {
    const isLegal = LEGAL_STATUSES.includes(status);

    it(`${isLegal ? 'allows' : 'blocks'} withdraw from ${status}`, async () => {
      const applicant = await createTestUser();
      const application = await createTestApplication(applicant, openPosition, {
        status,
      });

      actAs(applicant);
      const result = await withdrawApplication(application.id);

      if (isLegal) expect(result).toBeUndefined();
      else expect(result).toEqual({ error: WITHDRAW_NOT_ALLOWED_MESSAGE });
    });
  }
});

describe('deleteDraftApplication', () => {
  for (const status of ALL_STATUSES) {
    const isLegal = status === 'draft';

    it(`${isLegal ? 'allows' : 'blocks'} delete from ${status}`, async () => {
      const applicant = await createTestUser();
      const application = await createTestApplication(applicant, openPosition, {
        status,
      });

      actAs(applicant);
      const result = await deleteDraftApplication(application.id);

      if (isLegal) expect(result).toBeUndefined();
      else expect(result).toEqual({ error: DRAFT_DELETE_NOT_ALLOWED_MESSAGE });
    });
  }
});

describe('updateApplicationStatus', () => {
  // Full source x target matrix, driven off isAllowedApplicationStatusTransition
  // so this suite can't drift from the graph it's asserting against.
  for (const from of ALL_STATUSES) {
    const isNonReviewable = (
      NON_REVIEWABLE_APPLICATION_STATUSES as readonly string[]
    ).includes(from);

    for (const to of REVIEWER_APPLICATION_STATUSES) {
      const isSameStatus = from === to;
      const isLegal =
        !isNonReviewable &&
        !isSameStatus &&
        isAllowedApplicationStatusTransition(from, to);

      it(`${isNonReviewable ? 'throws' : isSameStatus ? 'reports already-set' : isLegal ? 'allows' : 'blocks'} ${from} -> ${to}`, async () => {
        const applicant = await createTestUser();
        const application = await createTestApplication(
          applicant,
          openPosition,
          { status: from },
        );

        actAs(admin);

        if (isNonReviewable) {
          await expect(
            updateApplicationStatus({
              applicationId: application.id,
              status: to,
            }),
          ).rejects.toThrow('Application not found or not authorized');
          return;
        }

        const result = await updateApplicationStatus({
          applicationId: application.id,
          status: to,
        });

        if (isSameStatus) {
          expect(result).toEqual({
            error: `This application is already ${APPLICATION_STATUS_LABELS[to]}.`,
          });
          return;
        }

        if (isLegal) {
          expect(result).toBeUndefined();
          const updated = await prisma.application.findUniqueOrThrow({
            where: { id: application.id },
            select: { status: true },
          });
          expect(updated.status).toBe(to);
          const event = await prisma.applicationStatusEvent.findFirstOrThrow({
            where: { applicationId: application.id },
            orderBy: { createdAt: 'desc' },
          });
          expect(event.from).toBe(from);
          expect(event.to).toBe(to);
        } else {
          expect(result).toEqual({
            error: `This application is now ${APPLICATION_STATUS_LABELS[from]}, so that move is no longer available. Refresh to see the current options.`,
          });
        }
      });
    }
  }

  it('overrides the graph and still writes an event when override is true', async () => {
    const applicant = await createTestUser();
    // 'accepted' has no forward/back/decision path to 'applied' in
    // APPLICATION_STATUS_TRANSITIONS — a genuinely off-graph move.
    const application = await createTestApplication(applicant, openPosition, {
      status: 'accepted',
    });

    actAs(admin);
    expect(isAllowedApplicationStatusTransition('accepted', 'applied')).toBe(
      false,
    );

    const result = await updateApplicationStatus({
      applicationId: application.id,
      status: 'applied',
      override: true,
    });

    expect(result).toBeUndefined();
    const updated = await prisma.application.findUniqueOrThrow({
      where: { id: application.id },
      select: { status: true },
    });
    expect(updated.status).toBe('applied');
    const event = await prisma.applicationStatusEvent.findFirstOrThrow({
      where: { applicationId: application.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(event.from).toBe('accepted');
    expect(event.to).toBe('applied');
  });

  it('refuses draft and withdrawn even with override (zod rejects the target)', async () => {
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, openPosition, {
      status: 'applied',
    });

    actAs(admin);
    const result = await updateApplicationStatus({
      applicationId: application.id,
      status: 'withdrawn',
      override: true,
    });
    expect(result).toEqual({ error: 'Invalid input' });
  });

  it('returns a zod error when the target status is draft', async () => {
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, openPosition, {
      status: 'applied',
    });

    actAs(admin);
    const result = await updateApplicationStatus({
      applicationId: application.id,
      status: 'draft',
    });
    expect(result).toEqual({ error: 'Invalid input' });
  });
});

describe('updateApplicationStatuses bulk mixed selections', () => {
  it('updates only the legal-source rows in a mixed selection and skips the rest', async () => {
    const appliedApplicant = await createTestUser();
    const appliedApp = await createTestApplication(
      appliedApplicant,
      openPosition,
      { status: 'applied' },
    );
    const acceptedApplicant = await createTestUser();
    const acceptedApp = await createTestApplication(
      acceptedApplicant,
      openPosition,
      { status: 'accepted' },
    );

    actAs(admin);
    const result = await updateApplicationStatuses({
      applicationIds: [appliedApp.id, acceptedApp.id],
      status: 'reviewing',
    });
    expect(result).toEqual({ updated: 1, skipped: 1 });

    const updatedApplied = await prisma.application.findUniqueOrThrow({
      where: { id: appliedApp.id },
      select: { status: true },
    });
    expect(updatedApplied.status).toBe('reviewing');

    const untouchedAccepted = await prisma.application.findUniqueOrThrow({
      where: { id: acceptedApp.id },
      select: { status: true },
    });
    expect(untouchedAccepted.status).toBe('accepted');
  });

  it('returns an error naming the target when no selected row can legally move there', async () => {
    const applicant = await createTestUser();
    // 'rejected' is excluded from getApplicationStatusForwardSources('accepted')
    // post-§5 (only the four unresolved statuses are acceptable sources).
    const application = await createTestApplication(applicant, openPosition, {
      status: 'rejected',
    });

    actAs(admin);
    const result = await updateApplicationStatuses({
      applicationIds: [application.id],
      status: 'accepted',
    });
    expect(result).toEqual({
      error:
        "None of the selected applications can move to Accepted — that's only reachable from Applied, Reached out, Interview scheduled, or Reviewing.",
    });
  });

  it('bulk-accepts from applied and reached_out now that Accept is symmetric with Reject', async () => {
    const appliedApplicant = await createTestUser();
    const appliedApp = await createTestApplication(
      appliedApplicant,
      openPosition,
      { status: 'applied' },
    );
    const reachedOutApplicant = await createTestUser();
    const reachedOutApp = await createTestApplication(
      reachedOutApplicant,
      openPosition,
      { status: 'reached_out' },
    );

    actAs(admin);
    const result = await updateApplicationStatuses({
      applicationIds: [appliedApp.id, reachedOutApp.id],
      status: 'accepted',
    });
    expect(result).toEqual({ updated: 2, skipped: 0 });

    const events = await prisma.applicationStatusEvent.findMany({
      where: { applicationId: { in: [appliedApp.id, reachedOutApp.id] } },
    });
    expect(events).toHaveLength(2);
    for (const event of events) expect(event.to).toBe('accepted');
    expect(new Set(events.map((e) => e.from))).toEqual(
      new Set(['applied', 'reached_out']),
    );
  });

  it('bulk-moves a back-only target (applied) since it has no forward source', async () => {
    const reachedOutApplicant = await createTestUser();
    const reachedOutApp = await createTestApplication(
      reachedOutApplicant,
      openPosition,
      { status: 'reached_out' },
    );
    const reviewingApplicant = await createTestUser();
    const reviewingApp = await createTestApplication(
      reviewingApplicant,
      openPosition,
      { status: 'reviewing' },
    );

    actAs(admin);
    const result = await updateApplicationStatuses({
      applicationIds: [reachedOutApp.id, reviewingApp.id],
      status: 'applied',
    });
    expect(result).toEqual({ updated: 1, skipped: 1 });

    const updatedReachedOut = await prisma.application.findUniqueOrThrow({
      where: { id: reachedOutApp.id },
      select: { status: true },
    });
    expect(updatedReachedOut.status).toBe('applied');

    const untouchedReviewing = await prisma.application.findUniqueOrThrow({
      where: { id: reviewingApp.id },
      select: { status: true },
    });
    expect(untouchedReviewing.status).toBe('reviewing');
  });
});

describe('ApplicationStatusEvent', () => {
  it('submitApplication writes an event from the draft/withdrawn status to applied', async () => {
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, openPosition, {
      status: 'draft',
    });
    await answerAllRequiredGlobalQuestions(applicant);

    actAs(applicant);
    await submitApplication(application.id);

    const event = await prisma.applicationStatusEvent.findFirstOrThrow({
      where: { applicationId: application.id },
    });
    expect(event.from).toBe('draft');
    expect(event.to).toBe('applied');
    expect(event.changedById).toBe(applicant.id);
  });

  it('withdrawApplication writes an event to withdrawn', async () => {
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, openPosition, {
      status: 'reviewing',
    });

    actAs(applicant);
    await withdrawApplication(application.id);

    const event = await prisma.applicationStatusEvent.findFirstOrThrow({
      where: { applicationId: application.id },
    });
    expect(event.from).toBe('reviewing');
    expect(event.to).toBe('withdrawn');
    expect(event.changedById).toBe(applicant.id);
  });

  it('undo (override back to the prior status) leaves two events, not zero', async () => {
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, openPosition, {
      status: 'applied',
    });

    actAs(admin);
    await updateApplicationStatus({
      applicationId: application.id,
      status: 'reviewing',
    });

    const latest = await getApplicationStatusHistory(application.id, admin);
    expect(latest[0]?.from).toBe('applied');

    // The hook's undo path: override back to the event's captured `from`.
    await updateApplicationStatus({
      applicationId: application.id,
      status: 'applied',
      override: true,
    });

    const events = await prisma.applicationStatusEvent.findMany({
      where: { applicationId: application.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ from: 'applied', to: 'reviewing' });
    expect(events[1]).toMatchObject({ from: 'reviewing', to: 'applied' });

    const updated = await prisma.application.findUniqueOrThrow({
      where: { id: application.id },
      select: { status: true },
    });
    expect(updated.status).toBe('applied');
  });

  it('getApplicationStatusHistory never returns another manager-scoped application', async () => {
    const managerA = await createTestUser({ isAdmin: false });
    const managerB = await createTestUser({ isAdmin: false });
    const positionA = await createTestPosition(managerA, {
      managers: [managerA],
    });
    const applicant = await createTestUser();
    const application = await createTestApplication(applicant, positionA, {
      status: 'applied',
    });

    actAs(admin);
    await updateApplicationStatus({
      applicationId: application.id,
      status: 'reviewing',
    });

    const asOwningManager = await getApplicationStatusHistory(
      application.id,
      managerA,
    );
    expect(asOwningManager.length).toBeGreaterThan(0);

    const asOtherManager = await getApplicationStatusHistory(
      application.id,
      managerB,
    );
    expect(asOtherManager).toEqual([]);
  });
});

describe('precedence', () => {
  it('an already-submitted application on a soft-deleted position returns the status error', async () => {
    const applicant = await createTestUser();
    const position = await createTestPosition(admin);
    const application = await createTestApplication(applicant, position, {
      status: 'applied',
    });
    await prisma.position.update({
      where: { id: position.id },
      data: { deletedAt: new Date() },
    });

    actAs(applicant);
    const result = await submitApplication(application.id);
    expect(result).toEqual({ error: APPLICATION_NOT_EDITABLE_MESSAGE });
  });

  it('a draft on a closed position returns the window error', async () => {
    const applicant = await createTestUser();
    const closedPosition = await createTestPosition(admin, {
      status: 'closed',
    });
    const application = await createTestApplication(applicant, closedPosition, {
      status: 'draft',
    });

    actAs(applicant);
    const result = await submitApplication(application.id);
    expect(result).toEqual({ error: POSITION_NOT_ACCEPTING_MESSAGE });
  });

  it('missing required position answers block submit', async () => {
    const applicant = await createTestUser();
    const position = await createTestPosition(admin);
    await createTestPositionQuestion(position, admin, { required: true });
    const application = await createTestApplication(applicant, position, {
      status: 'draft',
    });
    await answerAllRequiredGlobalQuestions(applicant);

    actAs(applicant);
    const result = await submitApplication(application.id);
    expect(result).toEqual({ error: MISSING_POSITION_ANSWERS_MESSAGE });
  });

  it('missing required profile answers block submit with the profile copy', async () => {
    const applicant = await createTestUser();
    // Very negative order guarantees this label survives formatMissingQuestions'
    // 3-name truncation regardless of how many other required questions exist.
    const requiredProfileQuestion = await createTestGlobalQuestion(admin, {
      required: true,
      order: -1_000_000,
    });
    const application = await createTestApplication(applicant, openPosition, {
      status: 'draft',
    });

    actAs(applicant);
    const result = await submitApplication(application.id);
    if (!isError(result)) throw new Error('expected an error result');
    expect(result.error).toContain(
      'Answer these required profile questions before submitting:',
    );
    expect(result.error).toContain(requiredProfileQuestion.label);
  });
});
