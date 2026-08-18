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
      const isLegal =
        !isNonReviewable && isAllowedApplicationStatusTransition(from, to);

      it(`${isNonReviewable ? 'throws' : isLegal ? 'allows' : 'blocks'} ${from} -> ${to}`, async () => {
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

        if (isLegal) {
          expect(result).toBeUndefined();
          const updated = await prisma.application.findUniqueOrThrow({
            where: { id: application.id },
            select: { status: true },
          });
          expect(updated.status).toBe(to);
        } else {
          expect(result).toEqual({
            error: `This application is now ${APPLICATION_STATUS_LABELS[from]}, so that move is no longer available. Refresh to see the current options.`,
          });
        }
      });
    }
  }

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
    const application = await createTestApplication(applicant, openPosition, {
      status: 'applied',
    });

    actAs(admin);
    const result = await updateApplicationStatuses({
      applicationIds: [application.id],
      status: 'accepted',
    });
    expect(result).toEqual({
      error: 'None of the selected applications can move to Accepted.',
    });
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
